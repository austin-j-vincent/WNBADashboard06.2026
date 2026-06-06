import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Relative base so the build works under any GitHub Pages subpath
export default defineConfig({
  base: './',
  plugins: [react()],
})
