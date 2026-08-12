import path from "path"
import { execSync } from "child_process"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
}

function buildStampPlugin(): Plugin {
  return {
    name: "courtaccess-build-stamp",
    transformIndexHtml(html) {
      const stamp = `<!-- CourtAccess build: ${gitSha()} ${new Date().toISOString()} -->`
      return html.replace("</head>", `    ${stamp}\n  </head>`)
    },
  }
}

export default defineConfig({
  plugins: [react(), buildStampPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        // The dev server proxies to whatever backend is running. Configurable
        // because the release listens on the port its .env declares — 3100 in the
        // documented deployment — while `npm start` in backend/ uses 3001, and a
        // hard-coded target silently sends every request to the wrong service.
        target: process.env.API_PROXY_TARGET ?? "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
