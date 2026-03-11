import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    charts: 'src/charts.ts',
    'preset/tailwind-preset': 'src/preset/tailwind-preset.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'tailwindcss', 'recharts'],
  treeshake: true,
  async onSuccess() {
    // Prepend "use client" to component bundles (index + charts) so Next.js
    // treats them as client modules.  Skip preset (pure config, no React).
    const distDir = join(import.meta.dirname, 'dist');
    const targets = ['index.js', 'index.cjs', 'charts.js', 'charts.cjs'];
    // Also patch shared chunks that contain React component code
    const chunks = readdirSync(distDir).filter(
      (f) => f.startsWith('chunk-') && (f.endsWith('.js') || f.endsWith('.cjs'))
    );
    for (const file of [...targets, ...chunks]) {
      const filePath = join(distDir, file);
      const content = readFileSync(filePath, 'utf-8');
      if (!content.startsWith('"use client"') && !content.startsWith("'use client'")) {
        writeFileSync(filePath, `"use client";\n${content}`);
      }
    }
  },
});
