import Vue from 'vue'
import App from './App.vue'
import AsyncComputed from 'vue-async-computed'

Vue.config.productionTip = false

const app = new Vue({
  render: h => h(App),
})

Vue.use(AsyncComputed)

app.$mount('#app')
