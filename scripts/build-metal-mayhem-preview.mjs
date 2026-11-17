// A standalone practice export. No auth SDK, production rewards or deployment.
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]||'dist/metal-mayhem-preview');await mkdir(out,{recursive:true});
const files=['metal-mayhem.css','metal-mayhem-display.woff2','metal-mayhem-engine.js','metal-mayhem-3d.js','metal-mayhem-rewards.js','metal-mayhem.js','metal-mayhem-font-LICENSE.txt','metal-mayhem-three-LICENSE.txt','game-preview-metal-mayhem.svg'];
for(const f of files)await copyFile(f,resolve(out,f));
const html=(await readFile('metal-mayhem.html','utf8')).replace('<script src="crystal-command-vendor.js"></script>','').replaceAll('href="games.html"','href="https://earnlyarcade.com/games.html"');
await writeFile(resolve(out,'index.html'),html);await writeFile(resolve(out,'metal-mayhem.html'),html);
console.log('Practice-only Metal Mayhem exported to '+out);
if(process.argv[3]){
 let single=html;
 let css=await readFile('metal-mayhem.css','utf8');
 css=css.replace("url('metal-mayhem-display.woff2')",`url('data:font/woff2;base64,${(await readFile('metal-mayhem-display.woff2')).toString('base64')}')`);
 single=single.replace('<link rel="stylesheet" href="metal-mayhem.css">','<style>'+css+'</style>');
 for(const file of ['metal-mayhem-engine.js','metal-mayhem-3d.js','metal-mayhem-rewards.js','metal-mayhem.js']){
  const code=(await readFile(file,'utf8')).replaceAll('</script','<\\/script');
  single=single.replace(`<script src="${file}"></script>`,()=>'<script>'+code+'</script>');
 }
 const notices=(await readFile('metal-mayhem-three-LICENSE.txt','utf8'))+'\n'+(await readFile('metal-mayhem-font-LICENSE.txt','utf8'));
 single+='\n<!-- Third-party license notices\n'+notices.replaceAll('--','—')+'\n-->\n';
 await writeFile(resolve(process.argv[3]),single);console.log('Self-contained practice file exported');
}
