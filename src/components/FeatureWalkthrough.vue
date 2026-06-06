<template>
  <div class="writing">
    <div class="ui stackable grid">
      <div class="twelve wide column">
        <form class="ui form" @submit.prevent="continueStory()">
          <div class="parents-list">
            <div class="ui parent segment" v-for="node in reversedCurrentAncestry" @click="goto(node)" :key="node.text">
              <i class="blue arrow large alternate circle left icon"></i> {{ node.text }}
            </div>
          </div>
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
          <div class="children-list">
            <div class="ui child segment" v-for="node in currentChildren" @click="goto(node)" :key="node.text">
              <i class="blue arrow large alternate circle right icon"></i> {{ node.text }}
              <i @click.stop="deleteNode(node)" class="ui delete close icon"></i>
            </div>
          </div>
          <button class="ui fluid icon blue labeled continue button" type="submit">
            <i class="arrow down icon"></i>
            Continue
          </button>
        </form>
      </div>
      <div class="four wide column sibling-column">
        <div class="ui segment siblings-panel">
          <h4 class="ui dividing header">Siblings</h4>
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
  watch: {
    storageKey () {
      this.loadTree()
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
    loadTree () {
      this.tree = new Tree(this.storageKey)
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
    fill (text) {
      this.currentNode.text = text.trim()
      this.tree.store()
    },
    saveCurrentNode () {
      this.tree.store()
    },
    deleteNode (node) {
      if (this.tree.contains(node, this.currentNode)) this.currentNode = node.parent || this.tree.root
      this.tree.destroy(node)
    },
    deleteCurrentNode () {
      if (!window.confirm('Delete this node and all of its children?')) return

      const node = this.currentNode
      this.currentNode = node.parent
      this.tree.destroy(node)
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
  constructor (storageKey) {
    this.storageKey = storageKey
    const nodes = JSON.parse(localStorage.getItem(this.storageKey) || '[]')
    nodes.forEach(n => {
      if (n.parent) n.parent = nodes.find(b => n.parent.text == b.text)
    })

    this.nodes = nodes

    const root = this.nodes.find(n => n.parent === null)
    if (root) {
      this.root = root
    } else {
      this.root = new Node(null, null)
      this.nodes.push(this.root)
      this.store()
    }
  }

  store () {
    Storage.store(this.storageKey, JSON.stringify(this.storableNodes()))
  }

  isEmpty (node) {
    return !node.text || !node.text.trim()
  }

  storableNodes () {
    return this.nodes.filter(node => {
      return node === this.root || !this.isEmpty(node) || this.children(node).length
    })
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

    this.store()

    return node.parent
  }

  left (node) {
    const children = this.nodes.filter(elt => {
      return elt.parent == node.parent
    })
    this.store()

    if (!node.parent) return children[children.indexOf(node) - 1] || children[children.length - 1] || node

    return children[children.indexOf(node) - 1] || this.appendLeftFrom(node.parent)
  }

  right (node) {
    const children = this.nodes.filter(elt => {
      return elt.parent == node.parent
    })
    this.store()

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
    this.store()
    return node
  }

  destroy (node, shouldStore = true) {
    this.children(node).forEach(child => this.destroy(child, false))
    const index = this.nodes.indexOf(node)
    if (index >= 0) this.nodes.splice(index, 1)
    if (shouldStore) this.store()
  }
}

class Storage {
  static store(key, value) {
    localStorage.setItem(key, value)
  }
}

// class BackendStorage {
//   store(key, value) {
//   }
// }
</script>

<style scoped>
.writing {
  padding: 2em;
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
  }
  .siblings-panel .ui.header {
    margin-bottom: 0.85rem;
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
  .children-list {
    height: 9rem;
    overflow-y: auto;
    margin-top: 1rem;
    padding-right: 0.25rem;
    @media (max-width: 768px) {
      max-height: 18rem;
      height: auto;
    }
  }
  .parents-list {
    height: 9.2rem;
    overflow-y: auto;
    margin-bottom: 1rem;
    padding-right: 0.25rem;
  }
  .parents-list .parent.segment:first-child {
    margin-top: 0;
    font-size: 1.2em;
    font-weight: bold;
  }
  .parents-list .parent.segment:last-child {
    margin-bottom: 0;
  }
  .children-list .child.segment:first-child {
    margin-top: 0;
  }
  .children-list .child.segment:last-child {
    margin-bottom: 0;
  }
  .continue.button {
    margin-top: 1rem;
  }
  .parent, .completion, .magic {
    cursor: pointer;
  }
</style>
