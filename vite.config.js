import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "vtopia-offline-shell",
      apply: "build",
      generateBundle(_, bundle) {
        this.emitFile({
          type: "asset",
          fileName: "licenses/VTOP-SOLVER-LICENSE.txt",
          source: readFileSync(
            new URL("./src/vendor/VTOP-SOLVER-LICENSE.txt", import.meta.url),
          ),
        });
        const assets = Object.keys(bundle)
          .filter(
            (name) => name.startsWith("assets/") && /\.(js|css)$/.test(name),
          )
          .map((name) => "/" + name)
          .sort();
        const version = createHash("sha256")
          .update(assets.join("|"))
          .digest("hex")
          .slice(0, 12);
        const source = readFileSync(
          new URL("./server/sw-template.js", import.meta.url),
          "utf8",
        )
          .replace("__BUILD_VERSION__", version)
          .replace("__PRECACHE_ASSETS__", JSON.stringify(assets));
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  ],
});
