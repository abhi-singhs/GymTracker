import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const defaultBase =
  process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/'
const base = process.env.VITE_BASE_PATH ?? defaultBase

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
