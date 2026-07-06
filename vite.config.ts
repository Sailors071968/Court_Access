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
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
