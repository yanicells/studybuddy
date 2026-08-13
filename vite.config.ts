import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro(process.env.VERCEL ? { preset: 'vercel' } : {}),
    react(),
  ],
})
