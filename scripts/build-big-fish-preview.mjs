// Export a practice-only playtest without changing the production catalog.
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]||'dist/big-fish-preview');
await mkdir(out,{recursive:true});
for(const name of ['big-fish-energy-engine.js','big-fish-energy-renderer.js','big-fish-energy-rewards.js','big-fish-energy.js','big-fish-energy.css','public-info.css','game-preview-big-fish-energy.webp'])await copyFile(name,resolve(out,name));
const page=(await readFile('big-fish-energy.html','utf8')).replace(/href="(index|games|about|game-guides|support|privacy|terms)\.html"/g,'href="https://earnlyarcade.com/$1.html"').replace('<script src="crystal-command-vendor.js"></script>','');
await writeFile(resolve(out,'index.html'),page);
await writeFile(resolve(out,'big-fish-energy.html'),page);
console.log('Practice-only Big Fish Energy preview exported');
