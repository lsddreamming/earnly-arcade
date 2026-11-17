import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
await build({entryPoints:['metal-mayhem-renderer-entry.js'],bundle:true,minify:true,format:'iife',target:'safari15',outfile:'metal-mayhem-3d.js'});
// Three's embedded shader templates retain insignificant trailing whitespace.
const path='metal-mayhem-3d.js';await writeFile(path,(await readFile(path,'utf8')).replace(/[\t ]+\n/g,'\n'));
