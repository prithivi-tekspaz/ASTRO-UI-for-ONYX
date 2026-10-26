// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  server: {
    port: 4321,
    host: true
  },
  vite: {
    server: {
      proxy: {
        '/v1': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true
        },
        '/api': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true
        },
        '/health': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true
        },
        '/ready': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true
        }
      }
    }
  }
});
