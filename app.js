import App from './main.js'

const app = Vue.createApp(App)
window.STORAGE_ITEM_ID = 'streamr-drive-web-config'
app.mount('#app')
