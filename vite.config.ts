import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pages = process.env.GITHUB_PAGES === "1";

export default defineConfig({
  base: pages ? "/shelf/" : "/",
  plugins: [react(), tailwindcss()],
});
