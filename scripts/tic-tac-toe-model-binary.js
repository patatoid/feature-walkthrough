const fs = require('fs')
const path = require('path')

const MAGIC = Buffer.from('PHICRV10', 'ascii')
const CONTROL_POINT_COUNT = 8
const DEFAULT_WASM_PATH = path.resolve(__dirname, '../public/phi_walkthrough_bg.wasm')

class BinaryWriter {
  constructor () {
    this.parts = []
  }

  bytes (value) {
    this.parts.push(Buffer.from(value))
  }

  uint8 (value) {
    const buffer = Buffer.allocUnsafe(1)
    buffer.writeUInt8(value)
    this.parts.push(buffer)
  }

  uint16 (value) {
    const buffer = Buffer.allocUnsafe(2)
    buffer.writeUInt16LE(value)
    this.parts.push(buffer)
  }

  uint32 (value) {
    const buffer = Buffer.allocUnsafe(4)
    buffer.writeUInt32LE(value)
    this.parts.push(buffer)
  }

  float32 (value) {
    const buffer = Buffer.allocUnsafe(4)
    buffer.writeFloatLE(value)
    this.parts.push(buffer)
  }

  string (value) {
    const buffer = Buffer.from(value, 'utf8')
    if (buffer.length > 255) throw new Error('Phi vocabulary tokens must fit in 255 UTF-8 bytes.')
    this.uint8(buffer.length)
    this.bytes(buffer)
  }

  finish () {
    return Buffer.concat(this.parts)
  }
}

function encodePhiModel (model) {
  const writer = new BinaryWriter()
  const training = model.training
  if (model.format !== 'tic-tac-toe-phi/v10' || model.phi.degree !== 2) throw new Error('Only degree-2 Phi v10 models can be encoded.')
  if (model.points.length !== CONTROL_POINT_COUNT) throw new Error('The Phi aggregate curve must have eight control points.')

  writer.bytes(MAGIC)
  writer.uint8(model.phi.degree)
  writer.uint8(CONTROL_POINT_COUNT)
  writer.uint16(model.vocabulary.length)
  writer.uint8(model.phi.responses.length)
  writer.uint32(model.examples)
  writer.uint32(model.epochs)
  model.points.forEach(point => writer.float32(point))

  writer.uint32(training.positions)
  writer.uint32(training.examples)
  writer.uint32(training.sampledPositions)
  writer.uint32(training.avoidableLossPositions)
  writer.uint16(training.maxPositionsPerPly)
  ;['win', 'avoidLoss', 'pat', 'loss'].forEach(outcome => writer.float32(training.targets[outcome]))
  ;['wins', 'avoidLosses', 'pats', 'losses'].forEach(outcome => writer.uint32(training.outcomes[outcome]))

  model.vocabulary.forEach(token => writer.string(token))
  model.phi.responses.forEach(response => {
    const populatedTerms = response.terms.filter(([, controlPoints]) => controlPoints.some(point => point !== 0))
    writer.uint8(Number(response.response))
    writer.uint32(populatedTerms.length)
    populatedTerms.forEach(([features, controlPoints]) => {
      writer.uint8(features.length)
      features.forEach(index => writer.uint8(index))
      if (controlPoints.length !== CONTROL_POINT_COUNT) throw new Error('Every sparse Phi term must have eight control points.')
      const pointMask = controlPoints.reduce((mask, point, index) => point === 0 ? mask : mask | (1 << index), 0)
      writer.uint8(pointMask)
      controlPoints.forEach((point, index) => {
        if (pointMask & (1 << index)) writer.float32(point)
      })
    })
  })

  return writer.finish()
}

function parsePhiModelWithWasm (bytes, wasmPath = DEFAULT_WASM_PATH) {
  const module = new WebAssembly.Module(fs.readFileSync(wasmPath))
  const wasm = new WebAssembly.Instance(module, {}).exports
  if (!wasm.parse_model) throw new Error('The WebAssembly module does not expose the binary Phi parser.')
  const input = Buffer.from(bytes)
  const inputPointer = wasm.alloc(input.length)
  new Uint8Array(wasm.memory.buffer, inputPointer, input.length).set(input)

  try {
    wasm.parse_model(inputPointer, input.length)
  } finally {
    wasm.dealloc(inputPointer, input.length)
  }

  const result = new Uint8Array(wasm.memory.buffer, wasm.result_ptr(), wasm.result_len())
  const model = JSON.parse(Buffer.from(result).toString('utf8'))
  if (model.error) throw new Error(model.error)
  return model
}

module.exports = { encodePhiModel, parsePhiModelWithWasm }
