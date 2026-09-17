import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  root: import.meta.dir,
  plugins: [
    {
      name: 'preview-context',
      enforce: 'pre',
      resolveId(id) {
        if (id === '@/desktop-app-provider' || id.endsWith('/src/desktop-app-provider')) return '\0preview-context';
      },
      load(id) {
        if (id === '\0preview-context') return 'export const useDesktopApp = () => ({remoteClient:null});';
      }
    },
    react(),
    tailwindcss()
  ],
  resolve: { alias: { '@': `${import.meta.dir}/src` } },
  server: { host: '127.0.0.1', port: 5199 }
});
await server.listen();
