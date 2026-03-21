import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:3000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/auth':  apiUrl,
        '/todos': apiUrl,
        '/users': apiUrl,
      },
    },
  }
})
