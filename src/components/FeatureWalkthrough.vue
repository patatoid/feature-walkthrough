<template>
  <div class="writing">
    <div class="ui stackable grid">
      <div class="twelve wide column">
        <form class="ui form" @submit.prevent="continueStory()">
          <div class="ui two column stackable grid">
            <div class="column">
              <div class="field editor-panel">
                <textarea ref="content" v-model="currentNode.text" @keyup="saveCurrentNode()" placeholder="Describe this feature..."></textarea>
              </div>
            </div>
            <div class="column">
              <div class="ui segment suggestions-panel">
                <h4 class="ui dividing header">AI suggestions</h4>
                <div class="suggestions-content">
                  <div class="suggestions-loader" v-if="$asyncComputed.currentCompletions.updating">
                    <i class="notched circle loading icon"></i>
                  </div>
                  <div class="ui icon message" v-else-if="!currentCompletions.length">
                    <i class="magic icon"></i>
                    <div class="content">
                      <div class="header">No AI suggestions yet</div>
                    </div>
                  </div>
                  <div class="ui completion segment" v-else v-for="completion in currentCompletions" @click="fill(completion)" :key="completion">
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
          <div class="child-list">
            <div class="ui child segment" v-for="node in currentChildren" @click="goto(node)" :key="node.text">
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
            <button class="ui icon button" type="button" @click="exportCurrentNode()">
              <i class="download icon"></i>
            </button>
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
import { SignJWT, jwtVerify } from 'jose'

export default {
  name: 'FeatureWalkthrough',
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
      text: ''
    }
  },
  mounted () {
    this.loadTree()
  },
  computed: {
    currentChildren () {
      return this.tree.children(this.currentNode)
    },
    currentSiblings () {
      return this.tree.children(this.currentNode.parent)
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
    },
    continueStory () {
      if (this.tree.isEmpty(this.currentNode)) return

      this.currentNode = this.tree.appendLeftFrom(this.currentNode)
    },
    up () {
      this.currentNode = this.tree.up(this.currentNode)
    },
    left () {
      this.currentNode = this.tree.left(this.currentNode)
    },
    right () {
      this.currentNode = this.tree.right(this.currentNode)
    },
    goto (node) {
      this.currentNode = this.tree.goto(node)
    },
    async fill (text) {
      if (!this.tree.isEmpty(this.currentNode)) {
        this.currentNode = this.tree.appendLeftFrom(this.currentNode)
      }
      this.currentNode.text = text.trim()
      await this.tree.store()
    },
    async saveCurrentNode () {
      await this.tree.store()
    },
    async deleteNode (node) {
      if (this.tree.contains(node, this.currentNode)) this.currentNode = node.parent || this.tree.root
      await this.tree.destroy(node)
    },
    async deleteCurrentNode () {
      if (!window.confirm('Delete this node and all of its children?')) return

      const node = this.currentNode
      this.currentNode = node.parent
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

    if (!node.parent) return children[children.indexOf(node) - 1] || children[children.length - 1] || node

    return children[children.indexOf(node) - 1] || this.appendLeftFrom(node.parent)
  }

  right (node) {
    const children = this.nodes.filter(elt => {
      return elt.parent == node.parent
    })

    if (!node.parent) return children[children.indexOf(node) + 1] || children[0] || node

    return children[children.indexOf(node) + 1] || this.appendRightFrom(node.parent)
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
    font-size: 1.25rem!important;
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
    height: 13rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
  .siblings-content {
    flex: 1 1 auto;
    overflow-y: auto;
    padding-right: 0.25rem;
  }
  .sibling.segment {
    cursor: pointer;
    overflow-wrap: anywhere;
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
    .delete {
      position: absolute;
      top: 1.2rem;
      right: 1rem;
    }
  }
  .child-list {
    height: 9rem;
    overflow-y: auto;
    margin-top: 1rem;
    padding-right: 0.25rem;
    @media (max-width: 768px) {
      height: 6rem;
    }
  }
  .parent-list {
    height: 9.2rem;
    overflow-y: auto;
    margin: 1rem 0;
    padding-right: 0.25rem;
    @media (max-width: 768px) {
      height: 6.2rem;
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
