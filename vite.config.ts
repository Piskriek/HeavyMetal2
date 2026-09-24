import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function trackPropsBackupPlugin(): Plugin {
  return {
    name: "track-props-backup-plugin",
    configureServer(server) {
      const backupDir = path.resolve(__dirname, "backups/props");
      const historyDir = path.resolve(backupDir, "history");
      try {
        fs.mkdirSync(historyDir, { recursive: true });
      } catch {}

      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split("?")[0] : "";

        // POST /api/backup-props: Save backup JSON to disk
        if (req.method === "POST" && url === "/api/backup-props") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", () => {
            try {
              const data = JSON.parse(body);
              const props = Array.isArray(data) ? data : data.props;
              const course = data.course || "default";
              const timestamp = data.timestamp || Date.now();

              if (Array.isArray(props)) {
                // 1. Save latest backup
                const latestFile = path.resolve(backupDir, "track-props-latest.json");

                // Safeguard: refuse to overwrite existing decorations if incoming array is empty or significantly smaller
                if (fs.existsSync(latestFile)) {
                  try {
                    const existing = JSON.parse(fs.readFileSync(latestFile, "utf-8"));
                    const existingCount = existing?.props?.length || 0;
                    if (existingCount > 0 && props.length < existingCount * 0.75) {
                      res.writeHead(200, { "Content-Type": "application/json" });
                      res.end(JSON.stringify({
                        success: false,
                        reason: `Refusing to overwrite ${existingCount} props with smaller set (${props.length} props)`,
                        count: existingCount,
                      }));
                      return;
                    }
                  } catch {}
                }

                const payload = {
                  course,
                  timestamp,
                  count: props.length,
                  updatedAt: new Date(timestamp).toISOString(),
                  props,
                };
                fs.writeFileSync(latestFile, JSON.stringify(payload, null, 2), "utf-8");

                // 2. Save history snapshot if there are props
                if (props.length > 0) {
                  const historyFile = path.resolve(historyDir, `props-${course}-${timestamp}.json`);
                  fs.writeFileSync(historyFile, JSON.stringify(payload, null, 2), "utf-8");

                  // Prune old history files if more than 30
                  const files = fs.readdirSync(historyDir).filter((f) => f.endsWith(".json"));
                  if (files.length > 30) {
                    files.sort();
                    for (let i = 0; i < files.length - 30; i++) {
                      try { fs.unlinkSync(path.resolve(historyDir, files[i])); } catch {}
                    }
                  }
                }

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, count: props.length, timestamp }));
                return;
              }
            } catch (err: any) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          });
          return;
        }

        // GET /api/backup-props: List available disk backups & latest state
        if (req.method === "GET" && url === "/api/backup-props") {
          try {
            const latestFile = path.resolve(backupDir, "track-props-latest.json");
            let latest = null;
            if (fs.existsSync(latestFile)) {
              latest = JSON.parse(fs.readFileSync(latestFile, "utf-8"));
            }

            const historyFiles = fs.existsSync(historyDir)
              ? fs.readdirSync(historyDir).filter((f) => f.endsWith(".json")).sort().reverse()
              : [];

            const history = historyFiles.slice(0, 20).map((f) => {
              try {
                const content = JSON.parse(fs.readFileSync(path.resolve(historyDir, f), "utf-8"));
                return {
                  filename: f,
                  count: content.count || content.props?.length || 0,
                  timestamp: content.timestamp || 0,
                  updatedAt: content.updatedAt || "",
                  course: content.course || "default",
                };
              } catch {
                return { filename: f, count: 0, timestamp: 0, updatedAt: "", course: "default" };
              }
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ latest, history }));
            return;
          } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // POST /api/restore-backup: Retrieve a specific history backup file
        if (req.method === "POST" && url === "/api/restore-backup") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", () => {
            try {
              const { filename } = JSON.parse(body);
              const safeName = path.basename(filename);
              const target = safeName === "track-props-latest.json"
                ? path.resolve(backupDir, safeName)
                : path.resolve(historyDir, safeName);
              if (fs.existsSync(target)) {
                const data = JSON.parse(fs.readFileSync(target, "utf-8"));
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(data));
                return;
              }
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Backup file not found" }));
              return;
            } catch (err: any) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          });
          return;
        }

        next();
      });
    },
  };
}

/**
 * M01 · T6: the lane-network mirror. Same shape as the props route above (`POST` writes a latest
 * file plus a history entry, and refuses to overwrite a much larger set with a much smaller one),
 * in its own directory, so the two documents can never be confused for one another.
 */
function lanePathsBackupPlugin(): Plugin {
  return {
    name: "lane-paths-backup-plugin",
    configureServer(server) {
      const backupDir = path.resolve(__dirname, "backups/lane-paths");
      const historyDir = path.resolve(backupDir, "history");
      try {
        fs.mkdirSync(historyDir, { recursive: true });
      } catch {}

      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split("?")[0] : "";
        if (req.method !== "POST" || url !== "/api/backup-lane-paths") { next(); return; }
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            const networks = data && typeof data.networks === "object" && data.networks !== null ? data.networks : null;
            if (!networks) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "A backup needs a networks object." }));
              return;
            }
            const countNodes = (value: Record<string, any>) => Object.values(value)
              .reduce((total: number, net: any) => total + (Array.isArray(net?.nodes) ? net.nodes.length : 0), 0);
            const timestamp = data.timestamp || Date.now();
            const latestFile = path.resolve(backupDir, "lane-paths-latest.json");
            const incoming = countNodes(networks);
            if (fs.existsSync(latestFile)) {
              try {
                const existing = JSON.parse(fs.readFileSync(latestFile, "utf-8"));
                const existingNodes = countNodes(existing?.networks ?? {});
                // The same guard the props route uses: never let a nearly-empty save wipe the mirror.
                if (existingNodes > 0 && incoming < existingNodes * 0.75) {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({
                    success: false,
                    reason: `Refusing to overwrite ${existingNodes} nodes with a smaller set (${incoming} nodes)`,
                    count: existingNodes,
                  }));
                  return;
                }
              } catch {}
            }
            const payload = { version: data.version ?? 1, course: data.course ?? "all", timestamp, count: incoming, updatedAt: new Date(timestamp).toISOString(), networks };
            fs.writeFileSync(latestFile, JSON.stringify(payload, null, 2));
            const historyFile = path.resolve(historyDir, `lane-paths-${timestamp}.json`);
            fs.writeFileSync(historyFile, JSON.stringify(payload, null, 2));
            const files = fs.readdirSync(historyDir).filter((file) => file.endsWith(".json")).sort();
            while (files.length > 40) {
              const oldest = files.shift();
              if (oldest) { try { fs.unlinkSync(path.resolve(historyDir, oldest)); } catch {} }
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, count: incoming, timestamp }));
          } catch (error: any) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), trackPropsBackupPlugin(), lanePathsBackupPlugin()],
  // Dev server: allow the sandbox preview proxy host (e.g. 5173-<id>.e2b.app).
  server: {
    host: '0.0.0.0',
    allowedHosts: [".e2b.app"],
    watch: {
      ignored: ["**/backups/**", "**/.git/**", "**/dist/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
