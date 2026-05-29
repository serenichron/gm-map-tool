import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// On build (GitHub Pages) assets live under /gm-map-tool/; dev stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/gm-map-tool/' : '/',
  plugins: [react(), tailwindcss()],
}))
