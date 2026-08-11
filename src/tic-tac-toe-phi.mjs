const CONTEXT_DECAY = 0.65
let binaryModelPromise

export function loadBinaryPhiModel (basePath = '/') {
  if (!binaryModelPromise) {
    binaryModelPromise = Promise.all([
      fetch(`${basePath}phi_walkthrough_bg.wasm`).then(response => {
        if (!response.ok) throw new Error(`Unable to load Phi WebAssembly (${response.status}).`)
        return response.arrayBuffer()
      }),
      fetch(`${basePath}tic-tac-toe.phi.bin`).then(response => {
        if (!response.ok) throw new Error(`Unable to load the binary Phi model (${response.status}).`)
        return response.arrayBuffer()
      })
    ]).then(async ([wasmBytes, modelBytes]) => {
      const { instance } = await WebAssembly.instantiate(wasmBytes, {})
      const wasm = instance.exports
      if (!wasm.parse_model) throw new Error('The Phi WebAssembly module cannot parse binary models.')
      const input = new Uint8Array(modelBytes)
      const inputPointer = wasm.alloc(input.length)
      new Uint8Array(wasm.memory.buffer, inputPointer, input.length).set(input)
      try {
        wasm.parse_model(inputPointer, input.length)
      } finally {
        wasm.dealloc(inputPointer, input.length)
      }
      const result = new Uint8Array(wasm.memory.buffer, wasm.result_ptr(), wasm.result_len())
      const model = JSON.parse(new TextDecoder().decode(result))
      if (model.error) throw new Error(model.error)
      return validatePhiModel(model)
    }).catch(error => {
      binaryModelPromise = null
      throw error
    })
  }
  return binaryModelPromise
}

function encodeBoard (board, history) {
  const boardFeatures = snapshot => {
    const xCount = snapshot.filter(cell => cell === 'X').length
    const oCount = snapshot.filter(cell => cell === 'O').length
    const turn = xCount === oCount ? 'x' : 'o'
    const cells = snapshot.map((cell, index) => `cell${index + 1}${cell === '' ? 'empty' : cell.toLowerCase()}`)
    return [`turn${turn}`, ...cells]
  }
  const snapshots = []
  if (history.length) {
    const replay = Array(9).fill('')
    snapshots.push([...replay])
    history.forEach((move, index) => {
      replay[move - 1] = index % 2 === 0 ? 'X' : 'O'
      snapshots.push([...replay])
    })
  } else {
    snapshots.push(board)
  }

  // Rust keeps the greatest ancestry weight when a feature occurs at several
  // levels. Mirror that rule so exported-model inference is byte-for-byte
  // equivalent to training semantics.
  const weightedFeatures = new Map()
  snapshots.forEach((snapshot, index) => {
    const value = CONTEXT_DECAY ** (snapshots.length - index - 1)
    boardFeatures(snapshot).forEach(token => {
      weightedFeatures.set(token, Math.max(weightedFeatures.get(token) || 0, value))
    })
  })
  return [...weightedFeatures].map(([token, value]) => ({ token, value }))
}

export function validatePhiModel (model) {
  if (!model || model.format !== 'tic-tac-toe-phi/v10') throw new Error('The public Phi model has an unsupported format.')
  if (!Array.isArray(model.vocabulary) || !model.phi || !Array.isArray(model.phi.responses)) throw new Error('The public model does not contain a Phi response function.')
  if (model.phi.kind !== 'weighted sparse curve function') throw new Error('The public model is not a weighted sparse curve function.')
  if (model.phi.degree !== 2) throw new Error('The public Phi model is not degree 2.')
  if (model.phi.inputDimension !== model.vocabulary.length || model.phi.resultDimension !== model.phi.responses.length) throw new Error('The public Phi model dimensions are inconsistent.')

  model.phi.responses.forEach(response => {
    if (!/^[1-9]$/.test(response.response) || !Array.isArray(response.terms)) throw new Error('The public Phi model contains an invalid response.')
    response.terms.forEach(term => {
      const [features, controlPoints] = term
      const validFeatures = Array.isArray(features) && features.length > 0 && features.length <= model.phi.degree && features.every(index => Number.isInteger(index) && index >= 0 && index < model.vocabulary.length)
      const validCurve = Array.isArray(controlPoints) && controlPoints.length === 8 && controlPoints.every(Number.isFinite)
      if (!validFeatures || !validCurve) throw new Error('The public Phi model contains an invalid sparse curve term.')
    })
  })

  return model
}

export function phi (model, board, history = []) {
  const vocabulary = new Map(model.vocabulary.map((token, index) => [token, index]))
  const features = encodeBoard(board, history).flatMap(feature => vocabulary.has(feature.token) ? [{
    index: vocabulary.get(feature.token),
    value: feature.value
  }] : []).sort((left, right) => left.index - right.index)
  const activeTerms = new Map()
  const collectTerms = (degree, start, selected, value) => {
    if (selected.length === degree) {
      activeTerms.set(selected.join(','), value)
      return
    }
    for (let index = start; index < features.length; index += 1) {
      collectTerms(degree, index + 1, [...selected, features[index].index], value * features[index].value)
    }
  }
  for (let degree = 1; degree <= model.phi.degree; degree += 1) collectTerms(degree, 0, [], 1)

  const curveValue = (controlPoints, input) => {
    const boundedInput = Math.max(0, Math.min(1, input))
    const scaled = boundedInput * (controlPoints.length - 1)
    const lower = Math.floor(scaled)
    const upper = Math.min(lower + 1, controlPoints.length - 1)
    const upperWeight = scaled - lower
    return boundedInput * (controlPoints[lower] * (1 - upperWeight) + controlPoints[upper] * upperWeight)
  }

  const legalMoves = board.flatMap((cell, index) => cell ? [] : [index + 1])
  return Object.fromEntries(model.phi.responses.filter(response => legalMoves.includes(Number(response.response))).map(response => {
    const points = response.terms.flatMap(([features, controlPoints]) => {
      const input = activeTerms.get(features.join(','))
      return input === undefined ? [] : [[features, curveValue(controlPoints, input)]]
    })
    const result = points.reduce((score, [, contribution]) => score + contribution, 0)
    return [response.response, { points, result }]
  }))
}

export function inferPhi (model, board, history = []) {
  const evaluations = phi(model, board, history)
  const candidates = Object.entries(evaluations).map(([response, evaluation]) => ({ response: Number(response), score: evaluation.result }))
  if (!candidates.length) {
    const response = board.findIndex(cell => !cell) + 1
    return { response, score: 0, evaluations }
  }
  const best = candidates.reduce((best, candidate) => {
    if (candidate.score > best.score) return candidate
    if (candidate.score === best.score && candidate.response < best.response) return candidate
    return best
  }, candidates[0])
  return { ...best, evaluations }
}
