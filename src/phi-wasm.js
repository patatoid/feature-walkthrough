let worker
let nextRequestId = 1
const pendingRequests = new Map()

function phiWorker () {
  if (!worker) {
    const baseUrl = process.env.BASE_URL || '/'
    worker = new Worker(`${baseUrl}phi-worker.js`)
    worker.onmessage = ({ data }) => {
      const request = pendingRequests.get(data.id)
      if (!request) return

      pendingRequests.delete(data.id)
      if (data.error) request.reject(new Error(data.error))
      else request.resolve(data.report)
    }
    worker.onerror = () => {
      pendingRequests.forEach(request => request.reject(new Error('The phi training worker stopped unexpectedly.')))
      pendingRequests.clear()
      worker.terminate()
      worker = null
    }
  }

  return worker
}

function cleanField (value) {
  return String(value || '').replace(/[\t\r\n]+/g, ' ').trim()
}

function parentOf (nodes, node) {
  if (!node.parent) return null
  return nodes.find(candidate => candidate.text === node.parent.text) || null
}

function trainingRows (nodes) {
  return nodes.filter(node => parentOf(nodes, node)).map(node => {
    const path = []
    let current = parentOf(nodes, node)
    const seen = new Set()

    while (current && !seen.has(current)) {
      seen.add(current)
      if (cleanField(current.text)) path.unshift(cleanField(current.text))
      current = parentOf(nodes, current)
    }

    const response = cleanField(node.text)
    // Rust treats each separator-delimited item as one ancestry level and
    // applies increasing weight as the path approaches the direct parent.
    return `${response}\t${path.join('\u001e')}`
  }).filter(row => row.split('\t')[1])
}

export async function trainWalkthroughPhi (nodes) {
  const input = trainingRows(nodes).join('\n')

  if (!input.length) throw new Error('The walkthrough has no feature text to train.')

  return new Promise((resolve, reject) => {
    const id = nextRequestId++
    pendingRequests.set(id, { resolve, reject })
    const baseUrl = process.env.BASE_URL || '/'
    phiWorker().postMessage({
      id,
      input,
      wasmUrl: `${baseUrl}phi_walkthrough_bg.wasm`
    })
  })
}
