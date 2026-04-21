import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: './browserify.js',
      name: '_encomBundle',
      formats: ['iife'],
      fileName: () => 'encom-globe.min.js',
    },
    outDir: 'build',
    emptyOutDir: false,
    minify: 'esbuild',
    commonjsOptions: {
      include: [/.*/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        strict: false,
      },
    },
  },
})
