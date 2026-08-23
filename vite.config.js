import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Deployment trigger: forces a fresh Vercel build to pick up vercel.json rewrites/crons.
export default defineConfig({
  plugins: [react()],
})
