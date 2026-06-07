<template>
  <div id="app">
    <div class="app-header">
      <button class="ui icon button" v-if="selectedProjectKey" @click="goHome()">
        <i class="home icon"></i>
      </button>
      <button class="ui red button" v-if="isLoggedIn" @click="logout()">Logout</button>
    </div>
    <div class="ui container home" v-if="!selectedProjectKey">
      <h1>Feature walkthrough</h1>
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
            <input v-model.trim="newProjectKey" required placeholder="Project key">
          </div>
          <div class="three wide field">
            <button class="ui fluid blue button" type="submit">Create</button>
          </div>
          <div class="three wide field">
            <button :disabled="!newProjectKey" class="ui fluid button" type="button" @click="selectImportFile()">
              Import
            </button>
          </div>
        </div>
      </form>

      <div class="ui relaxed divided list" v-if="projects.length">
        <div class="item project-item" v-for="projectKey in projects" :key="projectKey">
          <i class="large sitemap middle aligned icon"></i>
          <div class="content" @click="openProject(projectKey)">
            <div class="header">{{ projectKey }}</div>
            <div class="description">Stored in localStorage as {{ projectKey }}</div>
          </div>
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
        accept=".jwt,application/jwt,text/plain"
        @change="importProject"
      >

      <div class="ui right aligned large basic home-help segment">
        <h2 class="header">How to use Feature walkthrough</h2>
        <div class="ui left aligned blue segment">
          <h3>Create or import a project</h3>
          <p>Create a local project key, or import a signed JWT export. Imported projects use the JWT filename as their project name.</p>
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
import { SignJWT, jwtVerify } from 'jose'

const PROJECTS_STORAGE_KEY = 'featureWalkthroughProjects'
const DEFAULT_PROJECT_KEY = 'nodes'
const BASE_PATH = process.env.BASE_URL || '/'
const BORUTA_SERVER_PROJECT_KEY = 'boruta-server'
const BORUTA_SERVER_SEED_PATH = `${BASE_PATH}seeds/boruta-server.jwt`
const OPENAI_API_KEY_STORAGE_KEY = 'openaiApiKey'
const API_KEY_INACTIVITY_TIMEOUT = 30 * 60 * 1000
const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']

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
      openaiApiKeyInput: '',
      openaiApiKey: sessionStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || '',
      inactivityTimer: null
    }
  },
  computed: {
    isLoggedIn () {
      return Boolean(this.openaiApiKey)
    }
  },
  async mounted () {
    await this.seedBorutaServerProject()
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
    async seedBorutaServerProject () {
      if (!localStorage.getItem(BORUTA_SERVER_PROJECT_KEY)) {
        try {
          const response = await fetch(BORUTA_SERVER_SEED_PATH)
          if (!response.ok) throw new Error(`Seed request failed with ${response.status}`)

          const token = (await response.text()).trim()
          await jwtVerify(token, this.projectSecret(BORUTA_SERVER_PROJECT_KEY))
          localStorage.setItem(BORUTA_SERVER_PROJECT_KEY, token)
        } catch (error) {
          console.warn('Unable to seed boruta-server project.', error)
          return
        }
      }

      this.projects = this.loadProjects()
      this.ensureProjectListed(BORUTA_SERVER_PROJECT_KEY)
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
    async exportProject (projectKey) {
      let projectValue = localStorage.getItem(projectKey)
      if (projectValue === null) return
      if (projectValue.trim().startsWith('[')) {
        projectValue = await new SignJWT({ nodes: JSON.parse(projectValue) })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .sign(this.projectSecret(projectKey))
      }

      const blob = new Blob([projectValue], { type: 'application/jwt' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${projectKey}.jwt`
      link.click()
      URL.revokeObjectURL(link.href)
    },
    selectImportFile () {
      this.$refs.importInput.value = ''
      this.$refs.importInput.click()
    },
    importProject (event) {
      const file = event.target.files[0]
      if (!file) return
      const projectKey = this.newProjectKey
      if (!projectKey) return

      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const projectValue = reader.result
          await jwtVerify(projectValue, this.projectSecret(projectKey))
          if (localStorage.getItem(projectKey) && !window.confirm(`Overwrite existing project "${projectKey}"?`)) return

          localStorage.setItem(projectKey, projectValue)
          this.ensureProjectListed(projectKey)
          this.newProjectKey = ''
          this.openProject(projectKey)
        } catch (_error) {
          window.alert('The selected file is not a valid signed walkthrough JWT.')
        } finally {
          event.target.value = ''
        }
      }
      reader.readAsText(file)
    },
    projectSecret (projectKey) {
      return new TextEncoder().encode(projectKey)
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
  .project-import-input {
    display: none;
  }
</style>
