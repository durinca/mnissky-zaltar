import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Emits sw.js with a precache list of every built asset + data file, versioned by content hash. */
function serviceWorker(): Plugin {
  return {
    name: 'mz-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle);
      const data = readdirSync('public/data').map((f) => `data/${f}`);
      const extra = ['manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
      const list = [...new Set(['./', ...files.filter((f) => f !== 'sw.js'), ...data, ...extra])];
      const hash = createHash('sha1');
      for (const f of files) { const b = bundle[f]; hash.update(f + ('code' in b ? b.code : String(b.source))); }
      for (const f of data) hash.update(readFileSync(`public/${f}`));
      const version = hash.digest('hex').slice(0, 10);
      const src = readFileSync('src/sw.template.js', 'utf8').replaceAll('__VERSION__', version).replaceAll('__PRECACHE__', JSON.stringify(list));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'] },
});
