let wasmPromise

function loadWasm (wasmUrl) {
  if (!wasmPromise) {
    wasmPromise = fetch(wasmUrl)
      .then(response => {
        if (!response.ok) throw new Error(`Unable to load WebAssembly (${response.status}).`)
        return response.arrayBuffer()
      })
      .then(bytes => WebAssembly.instantiate(bytes, {}))
      .then(({ instance }) => instance.exports)
      .catch(error => {
        wasmPromise = null
        throw error
      })
  }

  return wasmPromise
}

self.onmessage = async event => {
  const { id, input, wasmUrl } = event.data

  try {
    const wasm = await loadWasm(wasmUrl)
    const bytes = new TextEncoder().encode(input)
    const inputPointer = wasm.alloc(bytes.length)
    new Uint8Array(wasm.memory.buffer, inputPointer, bytes.length).set(bytes)

    try {
      wasm.train_phi(inputPointer, bytes.length)
    } finally {
      wasm.dealloc(inputPointer, bytes.length)
    }

    const result = new Uint8Array(wasm.memory.buffer, wasm.result_ptr(), wasm.result_len())
    const report = JSON.parse(new TextDecoder().decode(result))
    if (report.error) throw new Error(report.error)

    self.postMessage({ id, report })
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Unable to train the walkthrough.' })
  }
}
