import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // o plugin do Nitro mudaria a porta de desenvolvimento para 3000; mantemos a 5173
  server: { port: 5173 },
  plugins: [
    tanstackStart({
      server: { entry: "./server.ts" },
    }),
    // gera um servidor Node (.output/server/index.mjs) para hospedar no Railway
    nitro(),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});
