<template>
  <span class="phi-button">
    <button
      class="ui teal icon button"
      type="button"
      title="Train and plot phi function"
      aria-label="Train and plot phi function"
      @click="openPlot()"
    >
      <i class="chart line icon"></i>
    </button>

    <div class="phi-overlay" v-if="isOpen" @click.self="closePlot()" @keydown.esc="closePlot()">
      <section class="ui segment phi-popover" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <header class="phi-header">
          <div>
            <h2 class="ui header" :id="titleId">phi learning curve</h2>
            <p>{{ projectKey }}</p>
          </div>
          <button ref="closeButton" class="ui icon button" type="button" aria-label="Close phi plot" @click="closePlot()">
            <i class="close icon"></i>
          </button>
        </header>

        <div class="phi-loading" v-if="loading" role="status" aria-live="polite">
          <div class="ui active centered inline loader"></div>
          <p>Training the sparse phi function locally in WebAssembly. Larger walkthroughs may take a moment.</p>
        </div>
        <div class="ui negative message" role="alert" v-else-if="error">{{ error }}</div>
        <template v-else-if="report">
          <div class="phi-stats">
            <span><strong>{{ report.examples }}</strong> parent-child examples</span>
            <span><strong>{{ report.features }}</strong> word features</span>
            <span><strong>{{ report.classes }}</strong> response classes</span>
            <span><strong>{{ report.epochs }}</strong> epochs</span>
          </div>
          <svg class="phi-chart" viewBox="0 0 720 340" role="img" :aria-label="`Learned phi curve for ${projectKey}`">
            <line x1="64" y1="24" x2="64" y2="292" class="axis" />
            <line x1="64" y1="292" x2="696" y2="292" class="axis" />
            <line v-for="tick in 5" :key="tick" x1="64" :y1="24 + (tick - 1) * 67" x2="696" :y2="24 + (tick - 1) * 67" class="grid" />
            <polyline :points="plotPoints" class="curve" />
            <circle v-for="point in chartPoints" :key="point.x" :cx="point.x" :cy="point.y" r="5" class="curve-point" />
            <text x="64" y="320" text-anchor="middle">0.00</text>
            <text x="696" y="320" text-anchor="middle">1.00</text>
            <text x="54" y="30" text-anchor="end">{{ maxLabel }}</text>
            <text x="54" y="296" text-anchor="end">{{ minLabel }}</text>
            <text x="380" y="336" text-anchor="middle">normalized input x</text>
          </svg>
          <p class="phi-note">Trained locally in WebAssembly. Each child is a response to its parent, with ancestry context decaying by 0.65 toward the root.</p>
        </template>
      </section>
    </div>
  </span>
</template>

<script>
import { trainWalkthroughPhi } from '../phi-wasm'

export default {
  name: 'PhiPlotButton',
  props: {
    projectKey: {
      type: String,
      required: true
    },
    loadNodes: {
      type: Function,
      required: true
    }
  },
  data () {
    return {
      isOpen: false,
      loading: false,
      error: '',
      report: null
    }
  },
  computed: {
    titleId () {
      return `phi-title-${this.projectKey.replace(/[^a-z0-9_-]/gi, '-')}`
    },
    chartRange () {
      const points = (this.report && this.report.points) || [0]
      const min = Math.min(...points)
      const max = Math.max(...points)
      const padding = Math.max((max - min) * 0.08, 0.01)
      return { min: min - padding, max: max + padding }
    },
    chartPoints () {
      const points = (this.report && this.report.points) || []
      const range = this.chartRange.max - this.chartRange.min
      return points.map((value, index) => ({
        x: 64 + (index / Math.max(points.length - 1, 1)) * 632,
        y: 292 - ((value - this.chartRange.min) / range) * 268
      }))
    },
    plotPoints () {
      return this.chartPoints.map(point => `${point.x},${point.y}`).join(' ')
    },
    minLabel () {
      return this.chartRange.min.toFixed(3)
    },
    maxLabel () {
      return this.chartRange.max.toFixed(3)
    }
  },
  methods: {
    async openPlot () {
      this.isOpen = true
      this.loading = true
      this.error = ''
      this.report = null
      this.$nextTick(() => this.$refs.closeButton && this.$refs.closeButton.focus())

      try {
        const nodes = await this.loadNodes()
        this.report = await trainWalkthroughPhi(nodes)
      } catch (error) {
        this.error = error.message || 'Unable to train this walkthrough.'
      } finally {
        this.loading = false
      }
    },
    closePlot () {
      this.isOpen = false
    }
  }
}
</script>

<style scoped>
.phi-button {
  display: inline-flex;
}
.phi-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
}
.phi-popover {
  width: min(820px, 100%);
  max-height: calc(100vh - 2rem);
  overflow: auto;
  padding: 1.5rem!important;
}
.phi-header, .phi-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.phi-header {
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
.phi-header h2, .phi-header p {
  margin: 0;
}
.phi-loading {
  padding: 2rem 1rem;
  text-align: center;
}
.phi-loading p {
  margin: 1.5rem 0 0;
  color: #64748b;
}
.phi-header p, .phi-note {
  color: #64748b;
}
.phi-stats {
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1rem;
}
.phi-stats span {
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  background: #f0fdfa;
  color: #115e59;
}
.phi-chart {
  width: 100%;
  height: auto;
  color: #475569;
  font: 13px Lato, sans-serif;
}
.axis {
  stroke: #64748b;
  stroke-width: 2;
}
.grid {
  stroke: #e2e8f0;
  stroke-width: 1;
}
.curve {
  fill: none;
  stroke: #00b5ad;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5;
}
.curve-point {
  fill: #fff;
  stroke: #008c86;
  stroke-width: 3;
}
.phi-note {
  margin: 0;
  text-align: center;
}
</style>
