<template>
  <span class="prompt-button">
    <button :class="buttonClass" type="button" @click="showPrompt()">
      <i class="terminal icon"></i>
    </button>

    <div class="prompt-overlay" v-if="isOpen" @click.self="closePrompt()">
      <div class="ui segment prompt-popover">
        <div class="prompt-header">
          <h2 class="ui header">{{ title }}</h2>
          <button class="ui icon button" type="button" @click="closePrompt()">
            <i class="close icon"></i>
          </button>
        </div>
        <p class="prompt-subject">{{ subject }}</p>
        <textarea
          ref="promptText"
          class="prompt-textarea"
          readonly
          :value="text"
        ></textarea>
        <div class="prompt-actions">
          <span class="prompt-copy-status" v-if="copyStatus" role="status" aria-live="polite">
            {{ copyStatus }}
          </span>
          <button class="ui blue icon labeled button" type="button" @click="copyPrompt()">
            <i class="copy icon"></i>
            Copy
          </button>
        </div>
      </div>
    </div>
  </span>
</template>

<script>
export default {
  name: 'PromptButton',
  props: {
    title: {
      type: String,
      default: 'Coding prompt'
    },
    buttonClass: {
      type: String,
      default: 'ui icon button'
    },
    prompt: {
      type: Function,
      required: true
    }
  },
  data () {
    return {
      isOpen: false,
      subject: '',
      text: '',
      copyStatus: '',
      copyStatusTimer: null
    }
  },
  beforeDestroy () {
    this.clearCopyStatus()
  },
  methods: {
    async showPrompt () {
      this.clearCopyStatus()
      const result = await this.prompt()
      this.subject = result.subject
      this.text = result.text
      this.isOpen = true
      this.$nextTick(() => {
        if (this.$refs.promptText) this.$refs.promptText.focus()
      })
    },
    closePrompt () {
      this.isOpen = false
      this.subject = ''
      this.text = ''
      this.clearCopyStatus()
    },
    async copyPrompt () {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(this.text)
          this.showCopyStatus()
          return
        }
      } catch (error) {
        // Fall back to the selected textarea copy path below.
      }

      if (!this.$refs.promptText) return

      this.$refs.promptText.select()
      if (document.execCommand('copy')) {
        this.showCopyStatus()
      }
    },
    showCopyStatus () {
      this.clearCopyStatus()
      this.copyStatus = 'Copied to clipboard'
      this.copyStatusTimer = window.setTimeout(() => {
        this.copyStatus = ''
        this.copyStatusTimer = null
      }, 2500)
    },
    clearCopyStatus () {
      if (this.copyStatusTimer) {
        window.clearTimeout(this.copyStatusTimer)
        this.copyStatusTimer = null
      }

      if (this.copyStatus) {
        this.copyStatus = ''
      }
    }
  }
}
</script>

<style scoped>
  .prompt-button {
    display: inline-flex;
  }
  .prompt-overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.35);
  }
  .prompt-popover {
    display: flex;
    flex-direction: column;
    width: min(900px, 100%);
    max-height: calc(100vh - 2rem);
  }
  .prompt-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  .prompt-header .ui.header {
    flex: 1 1 auto;
    margin: 0;
  }
  .prompt-subject {
    color: #616161;
    margin-bottom: 0.75rem;
  }
  .prompt-textarea {
    width: 100%;
    min-height: 45vh;
    resize: vertical;
    font-family: monospace;
    font-size: 0.95rem;
    line-height: 1.4;
    white-space: pre;
  }
  .prompt-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }
  .prompt-copy-status {
    color: #2185d0;
    font-weight: 600;
  }
</style>
