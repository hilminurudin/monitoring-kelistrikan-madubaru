import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
      server: {
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "https://epilogue-bash-chess.ngrok-free.dev",
          changeOrigin: true,
          secure: true,
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        },
      },
    },
  plugins: [react(), tailwindcss()],
})
