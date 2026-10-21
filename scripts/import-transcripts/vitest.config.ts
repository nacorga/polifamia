import { defineConfig } from 'vitest/config';

// Los tests comparten la BD polifamia_test y la truncan: un fichero cada vez.
export default defineConfig({ test: { fileParallelism: false } });
