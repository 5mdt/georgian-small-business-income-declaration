import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "/georgian-small-business-income-declaration/",
  plugins: [viteSingleFile()],
  build: {
    sourcemap: false,
  },
});
