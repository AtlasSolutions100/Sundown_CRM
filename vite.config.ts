import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// PORT is set by hosts like Replit; fall back to 5180 for local dev.
const port = Number(process.env.PORT) || 5180;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: { port, strictPort: true, host: '0.0.0.0', allowedHosts: true },
  preview: { port, strictPort: true, host: '0.0.0.0', allowedHosts: true },
});
