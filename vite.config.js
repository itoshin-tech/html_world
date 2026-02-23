import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages のベースパス設定
  // https://<username>.github.io/<repo>/ の形式に対応
  base: './', // または '/p30_html_world/'
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    open: true,
  },
});
