<template>
  <div class="tic-tac-toe-overlay" role="presentation" @click.self="close()">
    <section class="ui segment tic-tac-toe-dialog" role="dialog" aria-modal="true" aria-labelledby="tic-tac-toe-title">
      <header class="tic-tac-toe-header">
        <div>
          <h2 id="tic-tac-toe-title" class="ui header">Language model vs Phi</h2>
          <p class="tic-tac-toe-status" aria-live="polite">{{ status }}</p>
        </div>
        <button ref="closeButton" class="ui icon button" type="button" aria-label="Close Tic-Tac-Toe" @click="close()">
          <i class="close icon"></i>
        </button>
      </header>

      <div class="players" aria-label="Players">
        <span><strong class="x">X</strong> OpenAI language model</span>
        <span><strong class="o">O</strong> Phi curve model</span>
      </div>

      <div class="tic-tac-toe-board" role="grid" aria-label="Tic-Tac-Toe board">
        <div
          v-for="(cell, index) in board"
          :key="index"
          class="tic-tac-toe-cell"
          :class="{ x: cell === 'X', o: cell === 'O' }"
          role="gridcell"
          :aria-label="cellLabel(cell, index)"
        >
          {{ cell }}
        </div>
      </div>

      <figure v-if="phiModel" class="game-phi-plot">
        <figcaption>Game Phi curve</figcaption>
        <svg viewBox="0 0 420 210" role="img" aria-label="Aggregate Phi curve for the Tic-Tac-Toe model">
          <line x1="48" y1="18" x2="48" y2="166" class="plot-axis" />
          <line x1="48" y1="166" x2="402" y2="166" class="plot-axis" />
          <line v-for="tick in 4" :key="`grid-${tick}`" x1="48" :y1="18 + (tick - 1) * 49.33" x2="402" :y2="18 + (tick - 1) * 49.33" class="plot-grid" />
          <polyline :points="plotPoints" class="plot-curve" />
          <circle v-for="(point, index) in chartPoints" :key="`point-${index}`" :cx="point.x" :cy="point.y" r="3.5" class="plot-point" />
          <text x="48" y="186" text-anchor="middle">0</text>
          <text x="402" y="186" text-anchor="middle">1</text>
          <text x="40" y="24" text-anchor="end">{{ maxLabel }}</text>
          <text x="40" y="170" text-anchor="end">{{ minLabel }}</text>
          <text x="225" y="204" text-anchor="middle">normalized input x</text>
        </svg>
      </figure>

      <div v-if="modelLoading" class="ui icon message">
        <i class="notched circle loading icon"></i>
        <div class="content">Loading the public Phi model…</div>
      </div>
      <div v-else-if="!openaiApiKey" class="ui warning message">
        Enter an OpenAI API key on the home page to run the language-model player.
      </div>
      <div v-if="error" class="ui negative message" role="alert">{{ error }}</div>

      <button class="ui fluid blue button" type="button" :disabled="!canStart" @click="startMatch()">
        {{ hasMoves ? 'Play again' : 'Start match' }}
      </button>
      <p class="model-note" v-if="phiModel">
        Phi model: degree {{ phiModel.phi.degree }}, {{ phiModel.training.positions }} minimax positions, {{ phiModel.classes }} move classes.
      </p>
    </section>
  </div>
</template>

<script>
import axios from 'axios'
import { inferPhi, loadBinaryPhiModel } from '../tic-tac-toe-phi.mjs'

const BASE_PATH = process.env.BASE_URL || '/'
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
]

export default {
  name: 'TicTacToeGame',
  props: {
    openaiApiKey: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      board: Array(9).fill(''),
      moveHistory: [],
      currentPlayer: 'X',
      phiModel: null,
      modelLoading: true,
      running: false,
      error: '',
      matchId: 0
    }
  },
  computed: {
    winner () {
      const line = WINNING_LINES.find(indices => {
        const [first, ...rest] = indices
        return this.board[first] && rest.every(index => this.board[index] === this.board[first])
      })
      return line ? this.board[line[0]] : null
    },
    isDraw () {
      return !this.winner && this.board.every(Boolean)
    },
    gameOver () {
      return Boolean(this.winner) || this.isDraw
    },
    hasMoves () {
      return this.board.some(Boolean)
    },
    canStart () {
      return Boolean(this.openaiApiKey && this.phiModel && !this.running)
    },
    chartRange () {
      const points = (this.phiModel && this.phiModel.points) || [0]
      const min = Math.min(...points)
      const max = Math.max(...points)
      const padding = Math.max((max - min) * 0.08, 0.01)
      return { min: min - padding, max: max + padding }
    },
    chartPoints () {
      const points = (this.phiModel && this.phiModel.points) || []
      const range = this.chartRange.max - this.chartRange.min
      return points.map((value, index) => ({
        x: 48 + (index / Math.max(points.length - 1, 1)) * 354,
        y: 166 - ((value - this.chartRange.min) / range) * 148
      }))
    },
    plotPoints () {
      return this.chartPoints.map(point => `${point.x},${point.y}`).join(' ')
    },
    minLabel () {
      return this.chartRange.min.toFixed(2)
    },
    maxLabel () {
      return this.chartRange.max.toFixed(2)
    },
    status () {
      if (this.winner) return `${this.winner === 'X' ? 'Language model' : 'Phi'} wins!`
      if (this.isDraw) return 'Draw game.'
      if (this.running) return `${this.currentPlayer === 'X' ? 'Language model' : 'Phi'} is thinking…`
      if (this.modelLoading) return 'Preparing the match…'
      return 'Ready to play.'
    }
  },
  mounted () {
    window.addEventListener('keydown', this.handleKeydown)
    this.$nextTick(() => this.$refs.closeButton.focus())
    this.loadPhiModel()
  },
  beforeDestroy () {
    this.matchId += 1
    window.removeEventListener('keydown', this.handleKeydown)
  },
  methods: {
    async loadPhiModel () {
      this.modelLoading = true
      this.error = ''
      try {
        this.phiModel = await loadBinaryPhiModel(BASE_PATH)
      } catch (error) {
        this.error = error.message || 'Unable to load the public Phi model.'
      } finally {
        this.modelLoading = false
      }
    },
    async startMatch () {
      if (!this.canStart) return

      const matchId = ++this.matchId
      this.board = Array(9).fill('')
      this.moveHistory = []
      this.currentPlayer = 'X'
      this.running = true
      this.error = ''

      try {
        while (matchId === this.matchId && !this.gameOver) {
          const move = this.currentPlayer === 'X'
            ? await this.languageModelMove()
            : inferPhi(this.phiModel, this.board, this.moveHistory).response
          if (matchId !== this.matchId) return
          if (!Number.isInteger(move) || move < 1 || move > 9 || this.board[move - 1]) {
            throw new Error(`${this.currentPlayer === 'X' ? 'The language model' : 'Phi'} returned an illegal move.`)
          }

          this.$set(this.board, move - 1, this.currentPlayer)
          this.moveHistory.push(move)
          if (!this.gameOver) {
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X'
            await new Promise(resolve => window.setTimeout(resolve, 450))
          }
        }
      } catch (error) {
        const apiMessage = error.response && error.response.data && error.response.data.error && error.response.data.error.message
        this.error = apiMessage || error.message || 'The match stopped unexpectedly.'
      } finally {
        if (matchId === this.matchId) this.running = false
      }
    },
    async languageModelMove () {
      const legalMoves = this.board.flatMap((cell, index) => cell ? [] : [index + 1])
      const board = this.board.map(cell => cell || '.').join('')
      const { data } = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'Play optimal Tic-Tac-Toe as X. Choose exactly one legal square. Squares 1-9 run left-to-right, top-to-bottom.'
          },
          {
            role: 'user',
            content: `Current board: ${board}. Legal squares: ${legalMoves.join(', ')}.`
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'tic_tac_toe_move',
            strict: true,
            schema: {
              type: 'object',
              properties: { move: { type: 'integer', enum: legalMoves } },
              required: ['move'],
              additionalProperties: false
            }
          }
        }
      }, {
        timeout: 15000,
        headers: {
          Authorization: `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      })
      const content = data.choices && data.choices[0] && data.choices[0].message.content
      return JSON.parse(content).move
    },
    close () {
      this.matchId += 1
      this.$emit('close')
    },
    handleKeydown (event) {
      if (event.key === 'Escape') this.close()
    },
    cellLabel (cell, index) {
      const row = Math.floor(index / 3) + 1
      const column = (index % 3) + 1
      return cell ? `Row ${row}, column ${column}: ${cell}` : `Row ${row}, column ${column}: empty`
    }
  }
}
</script>

<style scoped>
.tic-tac-toe-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
}

.tic-tac-toe-dialog {
  width: min(100%, 28rem);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  margin: 0 !important;
  padding: 1.5rem !important;
}

.tic-tac-toe-header,
.players {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.tic-tac-toe-header {
  align-items: flex-start;
  margin-bottom: 1rem;
}

.tic-tac-toe-header h2,
.tic-tac-toe-status,
.model-note {
  margin: 0;
}

.tic-tac-toe-status,
.model-note {
  color: #616161;
}

.players {
  flex-wrap: wrap;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.players strong {
  margin-right: 0.25rem;
}

.tic-tac-toe-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.tic-tac-toe-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 2px solid #d4d4d5;
  border-radius: 0.35rem;
  background: #fff;
  color: #212121;
  font: 700 clamp(2rem, 12vw, 4rem) / 1 sans-serif;
}

.game-phi-plot {
  margin: 0 0 1rem;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.35rem;
  background: #f8fafc;
}

.game-phi-plot figcaption {
  margin-bottom: 0.35rem;
  color: #475569;
  font-weight: 700;
  text-align: center;
}

.game-phi-plot svg {
  display: block;
  width: 100%;
  height: auto;
  color: #64748b;
  font: 11px Lato, sans-serif;
}

.plot-axis {
  stroke: #64748b;
  stroke-width: 1.5;
}

.plot-grid {
  stroke: #e2e8f0;
  stroke-width: 1;
}

.plot-curve {
  fill: none;
  stroke: #00b5ad;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3.5;
}

.plot-point {
  fill: #fff;
  stroke: #008c86;
  stroke-width: 2;
}

.x {
  color: #2185d0;
}

.o {
  color: #db2828;
}

.model-note {
  margin-top: 0.75rem;
  text-align: center;
  font-size: 0.85rem;
}
</style>
