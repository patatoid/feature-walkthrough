const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')

const { parsePhiModelWithWasm } = require('./tic-tac-toe-model-binary')
const binaryModel = fs.readFileSync(require.resolve('../public/tic-tac-toe.phi.bin'))
const model = parsePhiModelWithWasm(binaryModel)

test('sparse binary is smaller than its reconstructed JSON model', () => {
  assert.ok(binaryModel.length < Buffer.byteLength(JSON.stringify(model)))
})

test('WASM rejects a corrupted binary model', () => {
  const corrupted = Buffer.from(binaryModel)
  corrupted[0] = 0
  assert.throws(() => parsePhiModelWithWasm(corrupted), /unsupported format/)
})

test('bundled training ranks avoid-loss moves with wins and keeps pat decay', () => {
  assert.equal(model.training.targets.win, 1)
  assert.equal(model.training.targets.avoidLoss, 1)
  assert.equal(model.training.targets.pat, 0.65)
  assert.equal(model.training.targets.loss, 0)
  assert.ok(model.training.outcomes.pats > 0)
  assert.ok(model.training.outcomes.wins > 0)
  assert.ok(model.training.outcomes.avoidLosses > 0)
  assert.ok(model.training.outcomes.losses > 0)
  assert.ok(model.training.avoidableLossPositions > model.training.sampledPositions)
})

test('training move history populates intermediate weighted curve points', () => {
  assert.ok(model.points.slice(0, -1).filter(point => point !== 0).length > 1)
  assert.ok(model.phi.responses.some(response => {
    return response.terms.some(([, controlPoints]) => controlPoints.slice(0, -1).some(point => point !== 0))
  }))
})

test('phi exposes vocabulary-indexed curve contributions whose sum is the result', async () => {
  const { phi, validatePhiModel } = await import('../src/tic-tac-toe-phi.mjs')
  validatePhiModel(model)

  const evaluations = phi(model, Array(9).fill(''))
  assert.deepEqual(Object.keys(evaluations), ['1', '2', '3', '4', '5', '6', '7', '8', '9'])

  Object.values(evaluations).forEach(({ points, result }) => {
    assert.ok(points.length > 0)
    assert.ok(points.every(([indices]) => indices.every(index => model.vocabulary[index])))
    const contributionSum = points.reduce((sum, [, contribution]) => sum + contribution, 0)
    assert.ok(Math.abs(contributionSum - result) < Number.EPSILON)
  })
})

test('phi omits occupied responses and inference returns a legal result', async () => {
  const { inferPhi, phi } = await import('../src/tic-tac-toe-phi.mjs')
  const board = ['X', '', '', '', 'O', '', '', '', '']
  const evaluations = phi(model, board)
  const inference = inferPhi(model, board)

  assert.equal(evaluations['1'], undefined)
  assert.equal(evaluations['5'], undefined)
  assert.equal(board[inference.response - 1], '')
  assert.equal(inference.score, inference.evaluations[inference.response].result)
})

test('phi reconstructs weighted board snapshots from ordered move history', async () => {
  const { phi } = await import('../src/tic-tac-toe-phi.mjs')
  const board = ['X', '', '', '', 'O', '', '', '', '']
  const currentBoardOnly = phi(model, board)
  const withSnapshots = phi(model, board, [1, 5])

  assert.equal(model.vocabulary.some(token => token.startsWith('history')), false)
  assert.ok(Object.keys(withSnapshots).some(response => {
    return withSnapshots[response].result !== currentBoardOnly[response].result
  }))
})
