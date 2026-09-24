import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const outDir = path.join(root, 'www');
const allowedExtensions = new Set([
  '.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.webmanifest'
]);
const excluded = new Set([
  'native-ads-entry.js',
  'playwright.config.js',
  'playwright.contract.config.js',
  'service-worker.js',
  'web-ads.js'
]);

await rm(outDir, { recursive:true, force:true });
await mkdir(outDir, { recursive:true });

const entries = await readdir(root, { withFileTypes:true });
for (const entry of entries) {
  if (!entry.isFile()) continue;
  if (excluded.has(entry.name)) continue;
  if (!allowedExtensions.has(path.extname(entry.name))) continue;
  await cp(path.join(root, entry.name), path.join(outDir, entry.name));
}

await build({
  entryPoints:[path.join(root, 'native-ads-entry.js')],
  outfile:path.join(outDir, 'native-ads.js'),
  bundle:true,
  format:'iife',
  platform:'browser',
  target:['safari15'],
  minify:false,
  sourcemap:false,
  define:{
    __EARNLY_ADMOB_TEST_MODE__: JSON.stringify(process.env.EARNLY_ADMOB_TEST_MODE !== '0')
  }
});

console.log('Prepared Earnly native web bundle in www/');
