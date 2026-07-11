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

function gitBranch(): string {
  // Prefer CI-provided ref name; fall back to git.
  const ci = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME
  if (ci) return ci
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
}

const BUILD_INFO = {
  commit: gitSha(),
  branch: gitBranch(),
  builtAt: new Date().toISOString(),
  version: "1.0.0",
}

function buildStampPlugin(): Plugin {
  return {
    name: "courtaccess-build-stamp",
    transformIndexHtml(html) {
      const stamp = `<!-- CourtAccess build: ${BUILD_INFO.commit} ${BUILD_INFO.builtAt} -->`
      return html.replace("</head>", `    ${stamp}\n  </head>`)
    },
    generateBundle() {
      // Emit a machine-readable build manifest so a deployment health check
      // can confirm which commit is actually live (curl /build-info.json).
      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source: JSON.stringify(BUILD_INFO, null, 2),
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  define: {
    // Exposed to the app so the running build can identify itself
    // (Settings → About). String-replaced at build time.
    __APP_BUILD__: JSON.stringify({ ...BUILD_INFO, mode }),
  },
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
}))
