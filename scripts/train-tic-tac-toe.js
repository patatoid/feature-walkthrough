#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const DEFAULT_WASM_PATH = path.resolve(__dirname, '../public/phi_walkthrough_bg.wasm')
const LEVEL_SEPARATOR = '\u001e'
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
]

function normalizeBoard (value, lineNumber) {
  const board = value.toUpperCase().replace(/[\s|/,]/g, '').replace(/[-_0]/g, '.')
  if (!/^[XO.]{9}$/.test(board)) {
    throw new Error(`Line ${lineNumber}: board must contain exactly nine X, O, or . cells.`)
  }

  const xCount = [...board].filter(cell => cell === 'X').length
  const oCount = [...board].filter(cell => cell === 'O').length
  if (xCount !== oCount && xCount !== oCount + 1) {
    throw new Error(`Line ${lineNumber}: board has an impossible number of X and O cells.`)
  }
  if (WINNING_LINES.some(line => line.every(index => board[index] !== '.' && board[index] === board[line[0]]))) {
    throw new Error(`Line ${lineNumber}: the game is already over.`)
  }

  return board
}

function normalizeMove (value, lineNumber) {
  const move = value.trim().toUpperCase()
  if (/^[1-9]$/.test(move)) return Number(move)
  if (/^[A-C][1-3]$/.test(move)) {
    const column = move.charCodeAt(0) - 65
    const row = Number(move[1]) - 1
    return row * 3 + column + 1
  }
  throw new Error(`Line ${lineNumber}: move must be 1-9 or a coordinate such as A1.`)
}

function normalizeHistory (value, board, lineNumber) {
  if (!value || !value.trim()) return []
  const history = value.trim().split(/[\s,;>]+/).map(move => normalizeMove(move, lineNumber))
  const replay = Array(9).fill('.')
  history.forEach((move, index) => {
    if (replay[move - 1] !== '.') throw new Error(`Line ${lineNumber}: history plays square ${move} more than once.`)
    replay[move - 1] = index % 2 === 0 ? 'X' : 'O'
  })
  if (replay.join('') !== board) throw new Error(`Line ${lineNumber}: history does not produce the supplied board.`)
  return history
}

function parseTsv (input) {
  const examples = []

  input.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1
    if (!line.trim() || line.trimStart().startsWith('#')) return

    const fields = line.split('\t')
    if (fields.length >= 2 && fields[0].trim().toLowerCase() === 'board' && fields[1].trim().toLowerCase() === 'move') return
    if (fields.length < 2 || fields.length > 3) throw new Error(`Line ${lineNumber}: expected board<TAB>move<TAB>history.`)

    const board = normalizeBoard(fields[0], lineNumber)
    const move = normalizeMove(fields[1], lineNumber)
    const history = normalizeHistory(fields[2], board, lineNumber)
    if (board[move - 1] !== '.') throw new Error(`Line ${lineNumber}: square ${move} is already occupied.`)

    examples.push({ board, move: String(move), history })
  })

  if (!examples.length) throw new Error('The TSV file has no training examples.')
  return examples
}

function encodeBoard (board, history = []) {
  const boardFeatures = snapshot => {
    const xCount = [...snapshot].filter(cell => cell === 'X').length
    const oCount = [...snapshot].filter(cell => cell === 'O').length
    const turn = xCount === oCount ? 'x' : 'o'
    const cells = [...snapshot].map((cell, index) => `cell${index + 1}${cell === '.' ? 'empty' : cell.toLowerCase()}`)
    return [`turn${turn}`, ...cells].join(' ')
  }
  if (!history.length) return boardFeatures(board)

  const replay = Array(9).fill('.')
  const snapshots = [replay.join('')]
  history.forEach((move, index) => {
    replay[move - 1] = index % 2 === 0 ? 'X' : 'O'
    snapshots.push(replay.join(''))
  })

  // Each complete position is an ancestry level, matching the feature-rich
  // root-to-parent paths used by walkthroughs. normalizeHistory guarantees
  // that the final replayed snapshot is the supplied current board.
  return snapshots.map(boardFeatures).join(LEVEL_SEPARATOR)
}

function trainingInput (examples) {
  return examples.map(example => `${example.move}\t${example.target == null ? 1 : example.target}\t${encodeBoard(example.board, example.history)}`).join('\n')
}

function trainPhi (examples, wasmPath = DEFAULT_WASM_PATH) {
  const module = new WebAssembly.Module(fs.readFileSync(wasmPath))
  const wasm = new WebAssembly.Instance(module, {}).exports
  const bytes = Buffer.from(trainingInput(examples), 'utf8')
  const inputPointer = wasm.alloc(bytes.length)
  new Uint8Array(wasm.memory.buffer, inputPointer, bytes.length).set(bytes)

  try {
    if (!wasm.train_model) throw new Error('The WebAssembly module is outdated. Run npm run build:wasm first.')
    wasm.train_model(inputPointer, bytes.length)
  } finally {
    wasm.dealloc(inputPointer, bytes.length)
  }

  const result = new Uint8Array(wasm.memory.buffer, wasm.result_ptr(), wasm.result_len())
  const report = JSON.parse(Buffer.from(result).toString('utf8'))
  if (report.error) throw new Error(report.error)
  const phi = {
    kind: 'weighted sparse curve function',
    degree: report.phi.degree,
    input: 'one-hot board feature vector',
    inputDimension: report.vocabulary.length,
    result: 'response score vector',
    resultDimension: report.phi.responses.length,
    training: 'outcome-weighted positive responses using the walkthrough weighted sparse curve learner',
    responses: report.phi.responses.map(response => ({
      response: response.response,
      // Keep the learner's control points so inference uses the same curve
      // interpolation as a walkthrough instead of flattening it to a weight.
      terms: response.curves.map(curve => [
        curve.features,
        curve.points
      ])
    }))
  }

  return {
    format: 'tic-tac-toe-phi/v10',
    implementation: 'phi_walkthrough_bg.wasm',
    board: {
      cells: 'nine X, O, or . cells in reading order',
      moves: '1-9 in reading order',
      history: 'ordered previous moves encoded by ply',
      inference: 'apply Phi to the encoded board and return the highest-scoring legal response'
    },
    ...report,
    phi
  }
}

function outputPathFor (inputPath) {
  const extension = path.extname(inputPath)
  const stem = extension ? inputPath.slice(0, -extension.length) : inputPath
  return path.resolve(`${stem}.phi.json`)
}

function usage () {
  return 'Usage: npm run train:tic-tac-toe -- <games.tsv> [model.phi.json]'
}

function main (args) {
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return args.length ? 0 : 1
  }
  if (args.length > 2) throw new Error(usage())

  const inputPath = path.resolve(args[0])
  const outputPath = args[1] ? path.resolve(args[1]) : outputPathFor(inputPath)
  const examples = parseTsv(fs.readFileSync(inputPath, 'utf8'))
  const model = trainPhi(examples)
  fs.writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`)
  console.log(`Trained ${model.examples} examples across ${model.classes} moves in ${model.epochs} epochs.`)
  console.log(`Wrote ${outputPath}`)
  return 0
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = { encodeBoard, normalizeBoard, normalizeHistory, normalizeMove, parseTsv, trainPhi, trainingInput }
