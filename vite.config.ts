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
  build: {
    // Split vendor libraries into cacheable chunks so the initial app chunk is
    // smaller and third-party code is cached across deploys (Program 11 perf).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined
          if (id.includes("react-router")) return "vendor-router"
          if (id.includes("/react-dom/") || /\/react\//.test(id) || id.includes("scheduler")) return "vendor-react"
          if (id.includes("recharts") || id.includes("d3") || id.includes("victory")) return "vendor-charts"
          if (id.includes("three") || id.includes("@react-three")) return "vendor-three"
          if (id.includes("lucide-react")) return "vendor-icons"
          if (id.includes("zustand") || id.includes("@tanstack")) return "vendor-state"
          return "vendor"
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
