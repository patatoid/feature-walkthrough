const test = require('node:test')
const assert = require('node:assert/strict')

const { encodeBoard, parseTsv, trainPhi, trainingInput } = require('./train-tic-tac-toe')

test('parses numbered and coordinate moves', () => {
  const examples = parseTsv('board\tmove\n.........\t5\nX........\tB2\n')
  assert.deepEqual(examples, [
    { board: '.........', move: '5', history: [] },
    { board: 'X........', move: '5', history: [] }
  ])
})

test('parses and validates previous moves as ordered context', () => {
  const [example] = parseTsv('X...O...X\t3\t1,5,9\n')
  assert.deepEqual(example.history, [1, 5, 9])
  assert.throws(() => parseTsv('X...O...X\t3\t1,9,5\n'), /does not produce/)
})

test('rejects moves into occupied squares', () => {
  assert.throws(() => parseTsv('X........\t1\n'), /already occupied/)
})

test('rejects positions where the game is over', () => {
  assert.throws(() => parseTsv('XXXOO....\t6\n'), /already over/)
})

test('encodes position-aware features for the WASM learner', () => {
  const examples = parseTsv('X...O....\t9\t1,5\n')
  assert.equal(encodeBoard(examples[0].board, examples[0].history), [
    'turnx cell1empty cell2empty cell3empty cell4empty cell5empty cell6empty cell7empty cell8empty cell9empty',
    'turno cell1x cell2empty cell3empty cell4empty cell5empty cell6empty cell7empty cell8empty cell9empty',
    'turnx cell1x cell2empty cell3empty cell4empty cell5o cell6empty cell7empty cell8empty cell9empty'
  ].join('\u001e'))
  assert.match(trainingInput(examples), /^9\t1\tturnx cell1empty/)
  assert.match(trainingInput([{ ...examples[0], target: 0.65 }]), /^9\t0\.65\t/)
})

test('trains with the existing WebAssembly implementation', () => {
  const examples = parseTsv('.........\t5\nX...O....\t9\n....X....\t1\n')
  const model = trainPhi(examples)

  assert.equal(model.format, 'tic-tac-toe-phi/v10')
  assert.equal(model.implementation, 'phi_walkthrough_bg.wasm')
  assert.equal(model.examples, 3)
  assert.equal(model.classes, 3)
  assert.equal(model.points.length, 8)
  assert.ok(model.vocabulary.includes('cell1empty'))
  assert.equal(model.phi.kind, 'weighted sparse curve function')
  assert.equal(model.phi.degree, 2)
  assert.equal(model.phi.inputDimension, model.vocabulary.length)
  assert.equal(model.phi.resultDimension, 3)
  assert.equal(model.phi.training, 'outcome-weighted positive responses using the walkthrough weighted sparse curve learner')
  assert.equal(model.phi.responses.length, 3)
  assert.ok(model.phi.responses.every(response => response.terms.some(([features]) => features.length === 2)))
  assert.ok(model.phi.responses.every(response => response.terms.every(([, points]) => points.length === 8 && points.every(Number.isFinite))))
  assert.doesNotThrow(() => JSON.stringify(model))
})
