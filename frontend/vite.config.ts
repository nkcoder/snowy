import path from 'node:path';
import react from '@vitejs/plugin-react';
import wails from '@wailsio/runtime/plugins/vite';
import { defineConfig, type Plugin } from 'vite';

const appModule = path.resolve(__dirname, 'src/backend/app.ts');
const e2eShim = path.resolve(__dirname, '../e2e/backend-shim.ts');

// Browser e2e has no Wails runtime, so swap the bindings for the window.go mock.
const mockBackend: Plugin = {
  name: 'e2e-mock-backend',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    return resolved?.id === appModule ? e2eShim : null;
  },
};

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
  plugins: [react(), wails('./bindings'), ...(process.env.E2E_MOCK ? [mockBackend] : [])],
});
