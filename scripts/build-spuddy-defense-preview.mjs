// Self-contained practice export: no account, wallet or production writes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]||'dist/spuddy-defense-preview');
await mkdir(out,{recursive:true});
const externalLinks=html=>html.replace(/href="(index|games|about|account|game-guides|support|privacy|terms)\.html"/g,'href="https://earnlyarcade.com/$1.html"');
let html=(await readFile('spuddy-defense.html','utf8'))
 .replace('<html lang="en">','<html lang="en" data-practice>')
 .replace('<script src="crystal-command-vendor.js"></script>','');
await writeFile('spuddy-defense-preview.html',externalLinks(html));
const css=await readFile('spuddy-defense.css','utf8');
const publicCss=await readFile('public-info.css','utf8');
html=html.replace('<link rel="stylesheet" href="public-info.css">',()=>'<style>'+publicCss+'</style>');
html=html.replace('<link rel="stylesheet" href="spuddy-defense.css">',()=>'<style>'+css+'</style>');
const cover='data:image/webp;base64,'+(await readFile('game-preview-spuddy-defense.webp')).toString('base64');
html=html.replaceAll('game-preview-spuddy-defense.webp',()=>cover);
for(const file of ['spuddy-defense-engine.js','spuddy-defense-renderer.js','spuddy-defense-online.js','spuddy-defense.js']){
 const source=(await readFile(file,'utf8')).replaceAll('</script','<\\/script');
 // Function replacements preserve literal dollar-sign expressions in source.
 html=html.replace('<script src="'+file+'"></script>',()=>'<script>'+source+'</script>');
}
html=externalLinks(html).replace("location.href='games.html'","location.href='https://earnlyarcade.com/games.html'");
await writeFile(resolve(out,'index.html'),html);
console.log('Practice preview exported to '+out);
