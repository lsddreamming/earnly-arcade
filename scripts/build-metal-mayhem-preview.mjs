// A standalone practice export. No auth SDK, production rewards or deployment.
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]||'dist/metal-mayhem-preview');await mkdir(out,{recursive:true});
const files=['metal-mayhem.css','metal-mayhem-display.woff2','metal-mayhem-engine.js','metal-mayhem-3d.js','metal-mayhem-rewards.js','metal-mayhem.js','metal-mayhem-font-LICENSE.txt','metal-mayhem-three-LICENSE.txt','game-preview-metal-mayhem.svg'];
for(const f of files)await copyFile(f,resolve(out,f));
const html=(await readFile('metal-mayhem.html','utf8')).replace('<script src="crystal-command-vendor.js"></script>','').replaceAll('href="games.html"','href="https://earnlyarcade.com/games.html"');
await writeFile(resolve(out,'index.html'),html);await writeFile(resolve(out,'metal-mayhem.html'),html);
console.log('Practice-only Metal Mayhem exported to '+out);
