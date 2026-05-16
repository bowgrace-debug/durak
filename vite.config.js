import { defineConfig } from 'vite'

export default defineConfig({
  base: '/durak/',
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'login.html',
        register: 'register.html',
        app: 'app.html',
      }
    }
  }
})
