#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const { trainPhi } = require('./train-tic-tac-toe')
const { encodePhiModel } = require('./tic-tac-toe-model-binary')

const OUTPUT_PATH = path.resolve(__dirname, '../public/tic-tac-toe.phi.bin')
const MAX_POSITIONS_PER_PLY = 80
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
]

function winner (board) {
  const line = WINNING_LINES.find(indices => indices.every(index => board[index] !== '.' && board[index] === board[indices[0]]))
  return line ? board[line[0]] : null
}

function legalMoves (board) {
  return [...board].flatMap((cell, index) => cell === '.' ? [index] : [])
}

function nextPlayer (board) {
  const xCount = [...board].filter(cell => cell === 'X').length
  const oCount = [...board].filter(cell => cell === 'O').length
  return xCount === oCount ? 'X' : 'O'
}

const minimaxCache = new Map()

function minimax (board) {
  if (winner(board)) return -1
  const moves = legalMoves(board)
  if (!moves.length) return 0
  if (minimaxCache.has(board)) return minimaxCache.get(board)

  const player = nextPlayer(board)
  const score = Math.max(...moves.map(move => {
    const nextBoard = `${board.slice(0, move)}${player}${board.slice(move + 1)}`
    return winner(nextBoard) ? 1 : -minimax(nextBoard)
  }))
  minimaxCache.set(board, score)
  return score
}

function scoredMoves (board) {
  const player = nextPlayer(board)
  return legalMoves(board).map(move => {
    const nextBoard = `${board.slice(0, move)}${player}${board.slice(move + 1)}`
    return { move, score: winner(nextBoard) ? 1 : -minimax(nextBoard) }
  })
}

function reachablePositions () {
  const positions = new Set()
  const visit = board => {
    if (positions.has(board) || winner(board) || !legalMoves(board).length) return
    positions.add(board)
    const player = nextPlayer(board)
    legalMoves(board).forEach(move => {
      visit(`${board.slice(0, move)}${player}${board.slice(move + 1)}`)
    })
  }
  visit('.........')
  return [...positions]
}

function sampleEvenly (positions, limit) {
  if (positions.length <= limit) return positions
  return Array.from({ length: limit }, (_, index) => positions[Math.floor(index * positions.length / limit)])
}

function trainingData () {
  const byPly = new Map()
  const allPositions = reachablePositions().sort()
  allPositions.forEach(board => {
    const ply = [...board].filter(cell => cell !== '.').length
    if (!byPly.has(ply)) byPly.set(ply, [])
    byPly.get(ply).push(board)
  })

  const sampledPositions = [...byPly.entries()].sort(([left], [right]) => left - right).flatMap(([, positions]) => {
    return sampleEvenly(positions, MAX_POSITIONS_PER_PLY)
  })
  // Safety-critical coverage is exhaustive for the player used by the game:
  // whenever O can still win or draw, train every legal alternative so Phi
  // sees the losing moves beside the available non-losing responses.
  const avoidableLossPositions = allPositions.filter(board => nextPlayer(board) === 'O' && minimax(board) >= 0)
  const trainingPositions = [...new Set([...sampledPositions, ...avoidableLossPositions])]
  const examples = trainingPositions.flatMap(board => {
    const moves = scoredMoves(board)
    const hasLosingAlternative = moves.some(({ score }) => score === -1)
    const xMoves = [...board].flatMap((cell, move) => cell === 'X' ? [move + 1] : [])
    const oMoves = [...board].flatMap((cell, move) => cell === 'O' ? [move + 1] : [])
    const history = xMoves.flatMap((move, moveIndex) => oMoves[moveIndex] ? [move, oMoves[moveIndex]] : [move])
    return moves.map(({ move, score }) => ({
      board,
      move: String(move + 1),
      history,
      score,
      outcome: score === 1 ? 'win' : score === 0 && hasLosingAlternative ? 'avoidLoss' : score === 0 ? 'pat' : 'loss',
      target: score === 1 || (score === 0 && hasLosingAlternative) ? 1 : score === 0 ? 0.65 : 0
    }))
  })
  return {
    examples,
    positions: trainingPositions.length,
    sampledPositions: sampledPositions.length,
    avoidableLossPositions: avoidableLossPositions.length
  }
}

const { examples, positions, sampledPositions, avoidableLossPositions } = trainingData()
const model = trainPhi(examples)
const outcomes = {
  wins: examples.filter(({ outcome }) => outcome === 'win').length,
  avoidLosses: examples.filter(({ outcome }) => outcome === 'avoidLoss').length,
  pats: examples.filter(({ outcome }) => outcome === 'pat').length,
  losses: examples.filter(({ outcome }) => outcome === 'loss').length
}
model.training = {
  strategy: 'all legal moves with outcome-weighted targets and exhaustive O avoidable-loss coverage',
  positions,
  examples: examples.length,
  sampledPositions,
  avoidableLossPositions,
  maxPositionsPerPly: MAX_POSITIONS_PER_PLY,
  targets: {
    win: 1,
    avoidLoss: 1,
    pat: 0.65,
    loss: 0
  },
  outcomes
}
fs.writeFileSync(OUTPUT_PATH, encodePhiModel(model))
console.log(`Trained ${examples.length} minimax moves from ${positions} positions.`)
console.log(`Wrote ${OUTPUT_PATH}`)
