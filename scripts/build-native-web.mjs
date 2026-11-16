import { cp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import {configureNativeEnvironment, nativeEnvironment} from './native-environment.mjs';

const environment = nativeEnvironment(process.env.EARNLY_BACKEND_ENVIRONMENT);

const root = process.cwd();
const outDir = path.join(root, 'www');
const allowedExtensions = new Set([
  '.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.webmanifest'
]);
const excluded = new Set([
  'coin-sandbox.html',
  'coin-sandbox.js',
  'native-ads-entry.js',
  'world-placement-entry.js',
  'native-purchases-entry.js',
  'native-share-entry.js',
  'native-alien-ar-entry.js',
  'alien-invasion-native.html',
  'crystal-command-client-entry.js',
  'playwright.config.js',
  'playwright.contract.config.js',
  'playwright.iphone-qa.config.js',
  'service-worker.js'
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

await build({entryPoints:['native-purchases-entry.js'],outfile:'www/native-purchases.js',bundle:true,format:'iife',platform:'browser',target:['safari15']});
await build({entryPoints:['native-share-entry.js'],outfile:'www/native-share.js',bundle:true,format:'iife',platform:'browser',target:['safari15'],minify:true});
await configureNativeEnvironment(outDir, environment.name);
console.log('Native backend: '+environment.name+' ('+environment.project+')');

if (process.env.EARNLY_ALIEN_AR_PREVIEW === '1') {
  await cp(path.join(root,'native/alien-invasion-native.html'),path.join(outDir,'alien-invasion-native.html'));
  await build({entryPoints:['native-alien-ar-entry.js'],outfile:'www/native-alien-ar.js',bundle:true,format:'iife',platform:'browser',target:['safari15'],minify:true});
  const indexPath=path.join(outDir,'index.html');
  let index=await readFile(indexPath,'utf8');
  const entry='<a id="alienARPreviewEntry" href="alien-invasion-native.html" style="position:fixed;z-index:100000;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom) + 80px);max-width:440px;margin:auto;padding:16px;border-radius:16px;background:#c4ff7a;color:#102719;font:800 16px system-ui;text-align:center;text-decoration:none;box-shadow:0 8px 40px #0008">Play Alien Invasion AR · Native test</a>';
  if(!index.includes('</body>'))throw new Error('Earnly home body missing; AR preview entry not installed.');
  index=index.replace('</body>',entry+'\n</body>');
  await writeFile(indexPath,index);
}
