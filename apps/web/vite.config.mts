import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxImportSource: '@emotion/react' })],
  server: {
    port: 5173,
    proxy: {
      // Keep the browser's Host (the string shorthand rewrites it), so the API's non-production
      // origin check accepts Origin http://localhost:5173 (#184).
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
});
