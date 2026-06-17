<template>
  <div class="writing">
    <div class="ui warning icon message">
      <i class="shield alternate icon"></i>
      <div class="content">
        <div class="header">Storage notice</div>
        <p>Projects are stored in localStorage and remain on this browser until deleted (<a href="/feature-walkthrough/">home</a>). If provided, the OpenAI API key is stored only in sessionStorage, but it is still available to this page while the tab is open; avoid using this app on shared or untrusted devices.</p>
      </div>
    </div>
    <div class="ui stackable grid">
      <div class="twelve wide column">
        <form class="ui form" @submit.prevent="continueStory()">
          <div class="ui two column stackable grid">
            <div class="column">
              <div class="field editor-panel">
                <textarea
                  ref="content"
                  v-model="currentNode.text"
                  @keyup="saveCurrentNode()"
                  @keydown.esc.prevent="$event.target.blur()"
                  placeholder="Describe this feature..."
                ></textarea>
              </div>
            </div>
            <div class="column">
              <div class="ui segment suggestions-panel">
                <h4 class="ui dividing header">AI suggestions</h4>
                <div class="suggestions-content" ref="suggestionsList">
                  <div class="suggestions-loader" v-if="$asyncComputed.currentCompletions.updating">
                    <i class="notched circle loading icon"></i>
                  </div>
                  <div class="ui icon message" v-else-if="!currentCompletions.length">
                    <i class="magic icon"></i>
                    <div class="content">
                      <div class="header">No AI suggestions yet</div>
                    </div>
                  </div>
                  <div
                    class="ui completion segment"
                    ref="suggestionItems"
                    v-else
                    v-for="(completion, index) in currentCompletions"
                    :class="{ 'blue inverted': index === focusedCompletionIndex }"
                    @click="fill(completion)"
                    :key="completion"
                  >
                    {{ completion }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="parent-list">
            <div class="ui parent segment" v-for="node in reversedCurrentAncestry" @click="goto(node)" :key="node.text">
              <i class="blue arrow large alternate circle left icon"></i> {{ node.text }}
            </div>
          </div>
          <div class="actions">
            <div class="field">
              <button type="button" @click="up()" :disabled="!currentNode.parent" class="ui fluid icon button">
                <i class="arrow up icon"></i>
              </button>
            </div>
            <div class="field">
            <button type="button" @click="deleteCurrentNode()" :disabled="!currentNode.parent" class="ui fluid red icon button">
                <i class="trash icon"></i>
              </button>
            </div>
            <div class="sibling-nav">
            <button type="button" @click="left()" :disabled="!currentNode.parent && currentSiblings.length <= 1" class="ui icon button">
                <i class="arrow left icon"></i>
              </button>
            <button type="button" @click="right()" :disabled="!currentNode.parent && currentSiblings.length <= 1" class="ui icon button">
                <i class="arrow right icon"></i>
              </button>
            </div>
            <button class="ui fluid icon blue labeled continue button" type="submit">
              <i class="arrow down icon"></i>
              Continue
            </button>
          </div>
          <div class="child-list" ref="childList">
            <div
              class="ui child segment"
              ref="childItems"
              v-for="(node, index) in currentChildren"
              :class="{ 'blue inverted': index === focusedChildIndex }"
              @click="goto(node)"
              :key="node.text"
            >
              <i class="blue arrow large alternate circle right icon"></i> {{ node.text }}
              <i @click.stop="deleteNode(node)" class="ui delete close icon"></i>
            </div>
          </div>
        </form>
      </div>
      <div class="four wide column sibling-column">
        <div class="ui segment siblings-panel">
          <div class="siblings-header">
            <h4 class="ui header">Siblings</h4>
            <div class="siblings-actions">
              <button class="ui icon button" type="button" @click="exportCurrentNode()">
                <i class="download icon"></i>
              </button>
              <PromptButton :prompt="currentNodePrompt" />
            </div>
          </div>
          <div class="siblings-content">
            <div
              class="ui sibling segment"
              v-for="node in currentSiblings"
              :class="{ 'blue inverted': node === currentNode }"
              @click="goto(node)"
              :key="node.text"
            >
              {{ node.text || 'Untitled node' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import PromptButton from './PromptButton.vue'
import { SignJWT, jwtVerify } from 'jose'

export default {
  name: 'FeatureWalkthrough',
  components: {
    PromptButton
  },
  props: {
    storageKey: {
      type: String,
      default: 'nodes'
    },
    openaiApiKey: {
      type: String,
      default: ''
    }
  },
  data () {
    const tree = new Tree(this.storageKey)

    return {
      tree: tree,
      currentNode: tree.root,
      focusedChildIndex: null,
      focusedCompletionIndex: null,
      text: ''
    }
  },
  mounted () {
    this.loadTree()
    window.addEventListener('keydown', this.navigateWithKeyboard)
  },
  beforeDestroy () {
    window.removeEventListener('keydown', this.navigateWithKeyboard)
  },
  computed: {
    currentChildren () {
      return this.tree.children(this.currentNode)
    },
    currentSiblings () {
      const siblings = this.tree.children(this.currentNode.parent)
      const currentIndex = siblings.indexOf(this.currentNode)
      if (currentIndex <= 0) return siblings

      return [
        this.currentNode,
        ...siblings.slice(currentIndex + 1),
        ...siblings.slice(0, currentIndex)
      ]
    },
    currentAncestry () {
      const ancestry = []
      let current = this.currentNode
      while (current && current.parent) {
        current = current.parent
        ancestry.unshift(current)
      }
      return ancestry
    },
    reversedCurrentAncestry () {
      return this.currentAncestry.slice().reverse()
    }
  },
  asyncComputed: {
    currentCompletions: {
      default: [],
      get () {
        if (!this.openaiApiKey) return Promise.resolve([])

        return openai.post('/completions', {
          "model": "gpt-4.1",
          "store": true,
          "messages": [
            {
              "role": "user",
              "content": `Current tree path, from root to parent only: ${this.currentAncestry.map(({ text }) => text).join(' > ')}. Suggest only direct child features for this parent. Ignore sibling features and every other branch, you can compose existing nodes. Only list ideas of 10 words with a label each idea separated by "---. No bullet points or numbering.".`
            }
          ]
        }, {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`
          }
        }).then(({ data }) => {
          return data.choices[0].message.content.split('---').map(text => text.trim()).filter(text => text)
        })
      }
    }
  },
  methods: {
    async loadTree () {
      this.tree = await this.tree.load()
      this.currentNode = this.tree.root
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
    },
    continueStory () {
      if (this.tree.isEmpty(this.currentNode)) return

      this.currentNode = this.tree.appendLeftFrom(this.currentNode)
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
      this.focusEditor()
    },
    continueSibling () {
      if (!this.currentNode.parent || this.tree.isEmpty(this.currentNode)) return

      this.currentNode = this.tree.appendRightFrom(this.currentNode.parent)
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
      this.focusEditor()
    },
    up () {
      if (this.focusedChildIndex !== null && this.currentChildren.length) {
        this.focusedChildIndex = this.focusedChildIndex === 0
          ? this.currentChildren.length - 1
          : this.focusedChildIndex - 1
        this.scrollFocusedChildToTop()
        return
      }

      this.currentNode = this.tree.up(this.currentNode)
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
    },
    left () {
      this.currentNode = this.tree.left(this.currentNode)
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
    },
    right () {
      this.currentNode = this.tree.right(this.currentNode)
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
    },
    down () {
      if (!this.currentChildren.length) return

      this.focusedChildIndex = this.focusedChildIndex === null
        ? 0
        : (this.focusedChildIndex + 1) % this.currentChildren.length
      this.scrollFocusedChildToTop()
    },
    scrollFocusedChildToTop () {
      this.$nextTick(() => {
        if (this.focusedChildIndex === null) return

        const wrapper = this.$refs.childList
        const children = this.$refs.childItems || []
        const child = children[this.focusedChildIndex]
        if (!wrapper || !child) return

        wrapper.scrollTop = child.offsetTop - wrapper.offsetTop
      })
    },
    scrollChildListToTop () {
      this.$nextTick(() => {
        const wrapper = this.$refs.childList
        if (wrapper) wrapper.scrollTop = 0
      })
    },
    enterFocusedChild () {
      if (this.focusedChildIndex === null) return

      const child = this.currentChildren[this.focusedChildIndex]
      if (child) this.goto(child)
    },
    pageDown () {
      this.focusCompletion(1)
    },
    pageUp () {
      this.focusCompletion(-1)
    },
    focusCompletion (direction) {
      if (!this.currentCompletions.length) return

      if (this.focusedCompletionIndex === null) {
        this.focusedCompletionIndex = direction > 0 ? 0 : this.currentCompletions.length - 1
      } else {
        this.focusedCompletionIndex = (this.focusedCompletionIndex + direction + this.currentCompletions.length) % this.currentCompletions.length
      }
      this.focusedChildIndex = null
      this.scrollFocusedSuggestionToTop()
    },
    scrollFocusedSuggestionToTop () {
      this.$nextTick(() => {
        if (this.focusedCompletionIndex === null) return

        const wrapper = this.$refs.suggestionsList
        const suggestions = this.$refs.suggestionItems || []
        const suggestion = suggestions[this.focusedCompletionIndex]
        if (!wrapper || !suggestion) return

        wrapper.scrollTop = suggestion.offsetTop - wrapper.offsetTop
      })
    },
    enterFocusedCompletion () {
      if (this.focusedCompletionIndex === null) return false

      const completion = this.currentCompletions[this.focusedCompletionIndex]
      if (!completion) return false

      this.fill(completion)
      return true
    },
    enter () {
      if (this.enterFocusedCompletion()) return

      if (this.focusedChildIndex !== null) {
        this.enterFocusedChild()
        return
      }

      this.down()
    },
    clearKeyboardFocus () {
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
    },
    focusEditor () {
      this.$nextTick(() => {
        if (this.$refs.content) this.$refs.content.focus()
      })
    },
    navigateWithKeyboard (event) {
      if (this.isTextInputEvent(event) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

      const movements = {
        ArrowUp: this.up,
        ArrowDown: this.down,
        ArrowLeft: this.left,
        ArrowRight: this.right,
        Enter: this.enter,
        Escape: this.clearKeyboardFocus,
        PageUp: this.pageUp,
        PageDown: this.pageDown,
        ' ': this.continueStory,
        Spacebar: this.continueStory,
        Delete: this.deleteCurrentNode
      }
      const movement = movements[event.key]
      if (!movement) return

      event.preventDefault()
      movement()
    },
    isTextInputEvent (event) {
      const tagName = event.target && event.target.tagName
      return event.target && (
        event.target.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT'
      )
    },
    goto (node) {
      this.currentNode = this.tree.goto(node)
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
    },
    async fill (text) {
      const parent = this.currentNode.parent || this.currentNode
      this.currentNode = this.tree.appendLeftFrom(parent)
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
      this.currentNode.text = text.trim()
      await this.tree.store()
      this.focusEditor()
    },
    async saveCurrentNode () {
      await this.tree.store()
    },
    async deleteNode (node) {
      if (this.tree.contains(node, this.currentNode)) this.currentNode = this.tree.afterDelete(node)
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
      await this.tree.destroy(node)
    },
    async deleteCurrentNode () {
      if (!window.confirm('Delete this node and all of its children?')) return

      const node = this.currentNode
      this.currentNode = this.tree.afterDelete(node)
      this.focusedChildIndex = null
      this.focusedCompletionIndex = null
      this.scrollChildListToTop()
      await this.tree.destroy(node)
    },
    async exportCurrentNode () {
      const token = await this.tree.exportNode(this.currentNode)
      const filename = `${this.storageKey}-${this.currentNode.text || 'untitled-node'}.jwt`
      const blob = new Blob([token], { type: 'application/jwt' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename.replace(/[^\w.-]+/g, '-')
      link.click()
      URL.revokeObjectURL(link.href)
    },
    currentNodePrompt () {
      const label = this.currentNode.text || 'Untitled node'
      return {
        subject: `Node: ${label}`,
        text: this.buildCodingPrompt(this.currentNode)
      }
    },
    buildCodingPrompt (node) {
      const outline = this.buildFeatureOutline(node)

      return `You are a senior software engineer. Build an application from the feature tree below.

Treat the tree as the source of truth for the product requirements. Each node is a feature, and child nodes refine or constrain the parent feature. Preserve the intent of the hierarchy when designing the app.

Project key: ${this.storageKey}
Selected node: ${node.text || 'Untitled node'}

Your task:
- Infer the application's core user workflow from the selected node and its child branches.
- Implement the smallest complete app that satisfies the tree.
- Prefer working software over placeholder screens.
- Use the existing project stack unless instructed otherwise.
- Keep code modular and readable.
- Add focused tests for core behavior where practical.
- Do not invent major product features outside the tree, except small glue behavior needed to make the app usable.

Feature tree:

${outline || '(No feature nodes yet.)'}

Implementation requirements:
- Build the actual usable application, not a landing page.
- Make the first screen the main user workflow.
- Persist user data locally unless the tree explicitly requires a backend.
- Include empty states, validation, deletion/undo behavior where implied by the tree.
- Make navigation match the tree's hierarchy when useful, but do not expose the tree literally unless that is the app's purpose.
- Keep the UI compact, clear, and responsive.
- After implementation, run lint/build/tests and report what passed or failed.

Before coding:
- Summarize the inferred product in 5-10 bullets.
- Identify ambiguous nodes and make conservative assumptions.
- Then implement without waiting for more clarification unless a requirement is impossible.`
    },
    buildFeatureOutline (rootNode) {
      const lines = []
      const walk = (node, depth) => {
        const text = node.text && node.text.trim()
        if (text) lines.push(`${'  '.repeat(depth)}- ${text}`)

        this.tree.children(node).forEach(child => {
          walk(child, text ? depth + 1 : depth)
        })
      }

      walk(rootNode, 0)

      return lines.join('\n')
    }
  }
}

const openai = axios.create({
  baseURL: 'https://api.openai.com/v1/chat',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

class Node {
  constructor(parent, text) {
    this.parent = parent
    this.text = text
  }
}

class Tree {
  constructor (storageKey, nodes = []) {
    this.storageKey = storageKey
    this.storage = new Storage(storageKey)
    this.nodes = nodes
    this.restoreParents()

    this.root = this.nodes.find(n => n.parent === null)
    if (!this.root) {
      this.root = new Node(null, null)
      this.nodes.push(this.root)
    }
  }

  async load () {
    const nodes = await this.storage.load()

    return Object.assign(this, new Tree(this.storageKey, nodes))
  }

  restoreParents () {
    const nodes = this.nodes
    nodes.forEach(n => {
      if (n.parent) n.parent = nodes.find(b => n.parent.text == b.text)
    })
  }

  async store () {
    await this.storage.store(this.storableNodes())
  }

  isEmpty (node) {
    return !node.text || !node.text.trim()
  }

  storableNodes () {
    return this.nodes.filter(node => {
      return node === this.root || !this.isEmpty(node) || this.children(node).length
    })
  }

  exportableNodes (rootNode) {
    return this.storableNodes().filter(node => this.contains(rootNode, node)).map(node => {
      if (node !== rootNode) return node

      return new Node(null, node.text)
    })
  }

  async exportNode (node) {
    return this.storage.sign(this.exportableNodes(node))
  }

  appendRightFrom (node) {
    const result = new Node(node)
    this.nodes.push(result)

    return result
  }

  appendLeftFrom (node) {
    const result = new Node(node)
    this.nodes.unshift(result)

    return result
  }

  up (node) {
    if (!node.parent) return node

    return node.parent
  }

  left (node) {
    const children = this.nodes.filter(elt => {
      return elt.parent == node.parent
    })

    return children[children.indexOf(node) - 1] || children[children.length - 1] || node
  }

  right (node) {
    const children = this.nodes.filter(elt => {
      return elt.parent == node.parent
    })

    return children[children.indexOf(node) + 1] || children[0] || node
  }

  afterDelete (node) {
    const siblings = this.children(node.parent)
    const index = siblings.indexOf(node)

    return siblings[index + 1] || siblings[index - 1] || node.parent || this.root
  }

  children(node) {
    const children = this.nodes.filter(elt => {
      return elt.parent == node
    })

    return children
  }

  contains (parent, node) {
    let current = node
    while (current) {
      if (current === parent) return true
      current = current.parent
    }

    return false
  }

  goto (node) {
    return node
  }

  async destroy (node, shouldStore = true) {
    for (const child of this.children(node)) {
      await this.destroy(child, false)
    }
    const index = this.nodes.indexOf(node)
    if (index >= 0) this.nodes.splice(index, 1)
    if (shouldStore) await this.store()
  }
}

class Storage {
  constructor (key) {
    this.key = key
  }

  async load() {
    const value = localStorage.getItem(this.key)
    if (!value) return []

    if (value.trim().startsWith('[')) return JSON.parse(value)

    const { payload } = await jwtVerify(value, this.secret)
    return payload.nodes || []
  }

  async store(nodes) {
    const token = await this.sign(nodes)

    localStorage.setItem(this.key, token)
  }

  async sign(nodes) {
    return new SignJWT({ nodes })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .sign(this.secret)
  }

  get secret() {
    return new TextEncoder().encode(this.key)
  }
}
</script>

<style scoped>
.writing {
  padding: 2rem;
  padding-top: 0;
  @media (max-width: 768px) {
    padding: 2rem 0;
  }
}
  textarea {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0!important;
    box-sizing: border-box;
    padding: 1.25rem 1.4rem!important;
    border: 1px solid #d7dce2!important;
    border-radius: 8px!important;
    background: #fbfcfe!important;
    color: #1f2933!important;
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)!important;
    font-family: Lato, 'Helvetica Neue', Arial, Helvetica, sans-serif!important;
    font-size: 2rem!important;
    line-height: 1.65!important;
    resize: vertical;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }
  .editor-panel {
    height: 20rem;
    display: flex;
    flex-direction: column;
  }
  .actions {
    margin-top: 1rem;
  }
  textarea:focus {
    border-color: #2185d0!important;
    background: #ffffff!important;
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 3px rgba(33, 133, 208, 0.14), 0 10px 28px rgba(15, 23, 42, 0.08)!important;
    outline: none!important;
  }
  .sibling-nav {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .sibling-nav .button {
    flex: 1 1 0;
  }
  .suggestions-panel {
    height: 20rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    @media (max-width: 768px) {
      height: 13rem;
    }
  }
  .walkthrough-grid {
    align-items: stretch!important;
  }
  .sibling-column {
    display: flex!important;
  }
  .content-column {
    display: flex!important;
    flex-direction: column;
  }
  .siblings-panel {
    width: 100%;
    height: 54.4855rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    @media (max-width: 768px) {
      height: auto;
    }
  }
  .siblings-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.85rem;
    flex: 0 0 auto;
    border-bottom: 1px solid rgba(34, 36, 38, 0.15);
    padding-bottom: 0.85rem;
  }
  .siblings-header .ui.header {
    flex: 1 1 auto;
    margin: 0;
  }
  .siblings-actions {
    display: flex;
    gap: 0.5rem;
    flex: 0 0 auto;
  }
  .siblings-content {
    flex: 1 1 auto;
    overflow-y: auto;
    padding-right: 0.25rem;
  }
  .sibling.segment {
    cursor: pointer;
    overflow-wrap: anywhere;
    &.inverted {
      font-size: 1.2em;
      font-weight: bold;
    }
  }
  .sibling.segment:first-child {
    margin-top: 0;
  }
  .sibling.segment:last-child {
    margin-bottom: 0;
  }
  .suggestions-panel .ui.header {
    margin-bottom: 0.85rem;
    flex: 0 0 auto;
  }
  .suggestions-content {
    flex: 1 1 auto;
    overflow-y: scroll;
    padding-right: 0.25rem;
  }
  .completion.segment {
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  .suggestions-loader {
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #2185d0;
    font-size: 1.5rem;
  }
  .child {
    cursor: pointer;
    padding-right: 3rem!important;
    &.inverted {
      font-size: 1.2em;
      font-weight: bold;
    }
    .delete {
      position: absolute;
      top: 1.2rem;
      right: 1rem;
    }
  }
  .child.segment.blue.inverted .icon {
    color: #fff!important;
  }
  .child-list {
    height: 9rem;
    overflow-y: auto;
    margin-top: 1rem;
    padding-right: 0.25rem;
    padding-bottom: 9rem;
    @media (max-width: 768px) {
      height: 7rem;
      padding-bottom: 7rem;
    }
  }
  .parent-list {
    height: 9.2rem;
    overflow-y: auto;
    margin: 1rem 0;
    padding-right: 0.25rem;
    @media (max-width: 768px) {
      height: 7.2rem;
    }
  }
  .parent-list .parent.segment:first-child {
    margin-top: 0;
    font-size: 1.2em;
    font-weight: bold;
  }
  .parent-list .parent.segment:last-child {
    margin-bottom: 0;
  }
  .child-list .child.segment:first-child {
    margin-top: 0;
  }
  .child-list .child.segment:last-child {
    margin-bottom: 0;
  }
  .continue.button {
    margin-top: 1rem;
  }
  .parent, .completion, .magic {
    cursor: pointer;
  }
</style>
