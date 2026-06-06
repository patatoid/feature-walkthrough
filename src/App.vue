<template>
  <div id="app">
    <div class="app-header">
      <button class="ui icon button" v-if="selectedProjectKey" @click="goHome()">
        <i class="home icon"></i>
      </button>
      <h1 v-if="selectedProjectKey">Feature walkthrough - {{ selectedProjectKey }}</h1>
      <h1 v-else>Feature walkthrough</h1>
      <button class="ui red button" v-if="isLoggedIn" @click="logout()">Logout</button>
    </div>

    <div class="ui container home" v-if="!selectedProjectKey">
      <div class="ui warning icon message">
        <i class="shield alternate icon"></i>
        <div class="content">
          <div class="header">Storage security</div>
          <p>Projects are stored in localStorage and remain on this browser until deleted. The OpenAI API key is stored only in sessionStorage, but it is still available to this page while the tab is open; avoid using this app on shared or untrusted devices.</p>
        </div>
      </div>

      <form class="ui form api-key-form" v-if="!isLoggedIn" @submit.prevent="saveOpenaiApiKey()">
        <div class="fields">
          <div class="twelve wide field">
            <input v-model.trim="openaiApiKeyInput" type="password" placeholder="OpenAI API key">
          </div>
          <div class="four wide field">
            <button class="ui fluid button" type="submit">Use key</button>
          </div>
        </div>
      </form>

      <form class="ui form new-project-form" @submit.prevent="createProject()">
        <div class="fields">
          <div class="ten wide field">
            <input v-model.trim="newProjectKey" required placeholder="LocalStorage key">
          </div>
          <div class="three wide field">
            <button class="ui fluid blue button" type="submit">Create</button>
          </div>
          <div class="three wide field">
            <button class="ui fluid button" type="button" @click="selectImportFile()">
              Import
            </button>
          </div>
        </div>
      </form>

      <div class="ui relaxed divided list" v-if="projects.length">
        <div class="item project-item" v-for="projectKey in projects" :key="projectKey">
          <i class="large sitemap middle aligned icon"></i>
          <div class="content" v-if="editingProjectKey !== projectKey" @click="openProject(projectKey)">
            <div class="header">{{ projectKey }}</div>
            <div class="description">Stored in localStorage as {{ projectKey }}</div>
          </div>
          <form class="ui form project-edit-form" v-else @submit.prevent="saveProjectTitle(projectKey)">
            <div class="ui action input">
              <input v-model.trim="editingProjectValue">
              <button class="ui blue icon button" type="submit">
                <i class="check icon"></i>
              </button>
              <button class="ui icon button" type="button" @click="cancelProjectTitleEdit()">
                <i class="close icon"></i>
              </button>
            </div>
          </form>
          <button class="ui icon button" v-if="editingProjectKey !== projectKey" @click="editProjectTitle(projectKey)">
            <i class="edit icon"></i>
          </button>
          <button class="ui icon button" @click="exportProject(projectKey)">
            <i class="download icon"></i>
          </button>
          <button class="ui red icon button" @click="deleteProject(projectKey)">
            <i class="trash icon"></i>
          </button>
        </div>
      </div>

      <div class="ui icon message" v-else>
        <i class="sitemap icon"></i>
        <div class="content">
          <div class="header">No walkthrough projects yet</div>
        </div>
      </div>

      <input
        ref="importInput"
        class="project-import-input"
        type="file"
        accept="application/json,.json"
        @change="importProject"
      >

      <div class="ui right aligned large basic home-help segment">
        <h2 class="header">How to use Feature walkthrough</h2>
        <div class="ui left aligned blue segment">
          <h3>Create or import a project</h3>
          <p>Create a local project key, or import a JSON export. Each project is stored separately in localStorage.</p>
        </div>
        <div class="ui left aligned blue segment">
          <h3>Edit the current feature</h3>
          <p>Open a project and write the feature description in the textarea. Changes are saved automatically as you type.</p>
        </div>
        <div class="ui left aligned blue segment">
          <h3>Move through the tree</h3>
          <p>Use parent, sibling, and child controls to move through the feature tree. Continue creates a child feature from the current node.</p>
        </div>
        <div class="ui left aligned blue segment">
          <h3>Use AI suggestions</h3>
          <p>Enter an OpenAI API key and click Use key. Suggestions then appear in projects and can fill the current node.</p>
        </div>
      </div>
    </div>

    <FeatureWalkthrough
      v-else
      :key="selectedProjectKey"
      :storage-key="selectedProjectKey"
      :openai-api-key="openaiApiKey"
    />

    <footer class="app-footer">
      <span>Feature walkthrough</span>
      <span>patatoid</span>
      <a href="https://github.com/patatoid/feature-walkthrough" target="_blank" rel="noopener noreferrer">source code</a>
    </footer>
  </div>
</template>

<script>
import FeatureWalkthrough from './components/FeatureWalkthrough.vue'

const PROJECTS_STORAGE_KEY = 'featureWalkthroughProjects'
const DEFAULT_PROJECT_KEY = 'nodes'
const OPENAI_API_KEY_STORAGE_KEY = 'openaiApiKey'
const API_KEY_INACTIVITY_TIMEOUT = 30 * 60 * 1000
const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']
const BASE_PATH = process.env.BASE_URL || '/'

export default {
  name: 'App',
  components: {
    FeatureWalkthrough
  },
  data () {
    return {
      projects: this.loadProjects(),
      selectedProjectKey: null,
      newProjectKey: '',
      editingProjectKey: null,
      editingProjectValue: '',
      openaiApiKeyInput: '',
      openaiApiKey: sessionStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || '',
      inactivityTimer: null,
      importProjectKey: null
    }
  },
  computed: {
    isLoggedIn () {
      return Boolean(this.openaiApiKey)
    }
  },
  mounted () {
    this.restoreProjectFromPath()
    window.addEventListener('popstate', this.restoreProjectFromPath)
    window.addEventListener('pagehide', this.clearOpenaiApiKey)
    window.addEventListener('beforeunload', this.clearOpenaiApiKey)
    ACTIVITY_EVENTS.forEach(eventName => {
      window.addEventListener(eventName, this.resetInactivityTimer, { passive: true })
    })
    this.resetInactivityTimer()
  },
  beforeDestroy () {
    window.removeEventListener('popstate', this.restoreProjectFromPath)
    window.removeEventListener('pagehide', this.clearOpenaiApiKey)
    window.removeEventListener('beforeunload', this.clearOpenaiApiKey)
    ACTIVITY_EVENTS.forEach(eventName => {
      window.removeEventListener(eventName, this.resetInactivityTimer)
    })
    this.clearInactivityTimer()
  },
  methods: {
    loadProjects () {
      const projects = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || '[]')
      if (!projects.length && localStorage.getItem(DEFAULT_PROJECT_KEY)) return [DEFAULT_PROJECT_KEY]

      return projects
    },
    storeProjects () {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(this.projects))
    },
    saveOpenaiApiKey () {
      this.openaiApiKey = this.openaiApiKeyInput

      if (this.openaiApiKey) {
        sessionStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, this.openaiApiKey)
        this.resetInactivityTimer()
      } else {
        sessionStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY)
        this.clearInactivityTimer()
      }
    },
    logout () {
      this.openaiApiKey = ''
      this.openaiApiKeyInput = ''
      this.clearOpenaiApiKey()
      this.clearInactivityTimer()
    },
    clearOpenaiApiKey () {
      sessionStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY)
    },
    clearInactivityTimer () {
      if (!this.inactivityTimer) return

      window.clearTimeout(this.inactivityTimer)
      this.inactivityTimer = null
    },
    resetInactivityTimer () {
      this.clearInactivityTimer()
      if (!this.openaiApiKey) return

      this.inactivityTimer = window.setTimeout(() => {
        this.logout()
      }, API_KEY_INACTIVITY_TIMEOUT)
    },
    projectPath (projectKey) {
      return `${BASE_PATH}${encodeURIComponent(projectKey)}`
    },
    projectKeyFromPath () {
      const path = window.location.pathname
      const basePath = BASE_PATH.replace(/\/$/, '')
      const projectPath = path.startsWith(basePath) ? path.slice(basePath.length) : path
      const key = projectPath.replace(/^\/+|\/+$/g, '')
      if (!key) return null

      return decodeURIComponent(key)
    },
    ensureProjectListed (projectKey) {
      if (this.projects.includes(projectKey)) return

      this.projects.push(projectKey)
      this.storeProjects()
    },
    restoreProjectFromPath () {
      const projectKey = this.projectKeyFromPath()
      this.projects = this.loadProjects()

      if (!projectKey) {
        this.selectedProjectKey = null
        return
      }

      this.ensureProjectListed(projectKey)
      this.selectedProjectKey = projectKey
    },
    createProject () {
      const projectKey = this.newProjectKey
      if (!projectKey || this.projects.includes(projectKey)) return

      this.projects.push(projectKey)
      this.storeProjects()
      this.newProjectKey = ''
      this.openProject(projectKey)
    },
    openProject (projectKey) {
      this.ensureProjectListed(projectKey)
      this.selectedProjectKey = projectKey
      window.history.pushState({}, '', this.projectPath(projectKey))
    },
    exportProject (projectKey) {
      const projectValue = localStorage.getItem(projectKey)
      if (projectValue === null) return

      const blob = new Blob([projectValue], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${projectKey}.json`
      link.click()
      URL.revokeObjectURL(link.href)
    },
    selectImportFile () {
      this.importProjectKey = this.newProjectKey
      this.$refs.importInput.value = ''
      this.$refs.importInput.click()
    },
    importProject (event) {
      const file = event.target.files[0]
      if (!file) return
      const projectKey = this.importProjectKey || file.name.replace(/\.json$/i, '')
      if (!projectKey) return

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const projectValue = reader.result
          JSON.parse(projectValue)
          localStorage.setItem(projectKey, projectValue)
          this.ensureProjectListed(projectKey)
          this.newProjectKey = ''
          this.openProject(projectKey)
        } catch (_error) {
          window.alert('The selected file is not valid JSON.')
        } finally {
          this.importProjectKey = null
        }
      }
      reader.readAsText(file)
    },
    editProjectTitle (projectKey) {
      this.editingProjectKey = projectKey
      this.editingProjectValue = projectKey
    },
    cancelProjectTitleEdit () {
      this.editingProjectKey = null
      this.editingProjectValue = ''
    },
    saveProjectTitle (projectKey) {
      const nextProjectKey = this.editingProjectValue
      if (!nextProjectKey || nextProjectKey === projectKey) {
        this.cancelProjectTitleEdit()
        return
      }
      if (this.projects.includes(nextProjectKey)) return

      const projectValue = localStorage.getItem(projectKey)
      if (projectValue !== null) {
        localStorage.setItem(nextProjectKey, projectValue)
        localStorage.removeItem(projectKey)
      }

      this.projects = this.projects.map(project => project === projectKey ? nextProjectKey : project)
      this.storeProjects()
      this.cancelProjectTitleEdit()

      if (this.selectedProjectKey === projectKey) {
        this.selectedProjectKey = nextProjectKey
        window.history.replaceState({}, '', this.projectPath(nextProjectKey))
      }
    },
    goHome () {
      this.selectedProjectKey = null
      this.projects = this.loadProjects()
      window.history.pushState({}, '', BASE_PATH)
    },
    deleteProject (projectKey) {
      if (!window.confirm(`Delete project "${projectKey}" from localStorage?`)) return

      localStorage.removeItem(projectKey)
      this.projects = this.projects.filter(project => project !== projectKey)
      this.storeProjects()
      if (this.selectedProjectKey === projectKey) this.goHome()
    }
  }
}
</script>

<style>
  html, body, #app {
    min-height: 100vh;
  }
  #app {
    display: flex;
    flex-direction: column;
  }
  .app-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: .5em;
  }
  .app-header h1 {
    margin: 0;
    text-align: center;
    flex: 1 1 auto;
  }
  .app-header .red.button {
    margin-left: auto;
  }
  .app-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
    margin-top: auto;
    padding: 2rem 1rem;
    color: #616161;
    font-size: 0.95rem;
  }
  .app-footer a {
    color: #2185d0;
  }
  .app-footer > * + *::before {
    content: "·";
    color: #9e9e9e;
    margin-right: 0.75rem;
  }
  .home {
    padding: 1rem;
  }
  .home-help {
    h2, h3 {
      color: #2185d0;
    }
    p {
      color: #616161;
    }
  }
  .api-key-form {
    margin-bottom: 1rem;
  }
  .new-project-form {
    margin-bottom: 2rem;
  }
  .project-item {
    display: flex!important;
    align-items: center;
    gap: 1rem;
  }
  .project-item .content {
    flex: 1 1 auto;
    cursor: pointer;
  }
  .project-edit-form {
    flex: 1 1 auto;
  }
  .project-edit-form .input {
    width: 100%;
  }
  .project-import-input {
    display: none;
  }
</style>
