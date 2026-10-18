import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({ build: { rollupOptions: { input: { portal: resolve('index.html'), chapter1: resolve('capitulos/01-descobrindo-o-tenis/index.html'), lia: resolve('prototipos/lia-voz/index.html'), avatar: resolve('prototipos/avatar-3d/index.html') } } } });
