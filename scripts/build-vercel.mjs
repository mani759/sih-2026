// Builds the app in Vercel's Build Output API format (.vercel/output):
//   static/            -> Vite frontend (dist/)
//   functions/api.func -> Express API bundled into one CommonJS file, plus server/data
//   config.json        -> routing: static files first, /api/* to Express, everything else to the SPA
// Bundling avoids Node ESM import-resolution errors ("type": "module" + extensionless imports).
import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '.vercel/output';
const FUNCTION_DIR = path.join(OUTPUT_DIR, 'functions', 'api.func');

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });

// 1. Frontend
execSync('npx vite build', { stdio: 'inherit' });
fs.cpSync('dist', path.join(OUTPUT_DIR, 'static'), { recursive: true });

// 2. API function
await build({
  entryPoints: ['vercel/api-entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: path.join(FUNCTION_DIR, 'index.cjs'),
  // Vercel's Node launcher calls module.exports as the (req, res) handler
  footer: { js: 'module.exports = module.exports.default;' },
  external: ['bufferutil', 'utf-8-validate'],
  logLevel: 'info'
});

// The API reads server/data/*.json relative to process.cwd(), which is the function root on Vercel
fs.cpSync('server/data', path.join(FUNCTION_DIR, 'server', 'data'), { recursive: true });

fs.writeFileSync(
  path.join(FUNCTION_DIR, '.vc-config.json'),
  JSON.stringify({
    runtime: 'nodejs22.x',
    handler: 'index.cjs',
    launcherType: 'Nodejs',
    shouldAddHelpers: false,
    maxDuration: 60
  }, null, 2)
);

// 3. Routing
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'config.json'),
  JSON.stringify({
    version: 3,
    routes: [
      { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
      { handle: 'filesystem' },
      { src: '^/api(/.*)?$', dest: '/api' },
      { src: '^/(.*)$', dest: '/index.html' }
    ]
  }, null, 2)
);

console.log(`Vercel build output written to ${OUTPUT_DIR}`);
