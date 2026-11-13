// Self-contained practice export: no account, wallet or production writes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]||'dist/spuddy-defense-preview');await mkdir(out,{recursive:true});
let html=await readFile('spuddy-defense.html','utf8');html=html.replace('<html lang="en">','<html lang="en" data-practice>');
await writeFile('spuddy-defense-preview.html',html.replace('<script src="crystal-command-vendor.js"></script>','').replace(/href="(games|account|game-guides|support|privacy|terms)\.html"/g,'href="https://earnlyarcade.com/$1.html"'));
html=html.replace('<link rel="stylesheet" href="spuddy-defense.css">','<style>'+(await readFile('spuddy-defense.css','utf8')).replace("@import url('public-info.css');",'')+'</style>');
html=html.replaceAll('game-preview-spuddy-defense.webp','data:image/webp;base64,'+(await readFile('game-preview-spuddy-defense.webp')).toString('base64'));
html=html.replace('<script src="crystal-command-vendor.js"></script>','');
for(const file of ['spuddy-defense-engine.js','spuddy-defense-renderer.js','spuddy-defense-online.js','spuddy-defense.js'])html=html.replace('<script src="'+file+'"></script>','<script>'+(await readFile(file,'utf8')).replaceAll('</script','<\\/script')+'</script>');
html=html.replace(/href="(games|account|game-guides|support|privacy|terms)\.html"/g,'href="https://earnlyarcade.com/$1.html"').replace("location.href='games.html'","location.href='https://earnlyarcade.com/games.html'");
await writeFile(resolve(out,'index.html'),html);console.log('Practice preview exported to '+out);
