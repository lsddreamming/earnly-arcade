import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
// Pilot accounts are free. All delivered files receive a baked-in mark before review.
export async function markPilotMedia(blob,kind){
  const image=kind==='image';
  const directory=await mkdtemp(path.join(tmpdir(),'earnly-studio-'));
  const extension=image?'jpg':'mp4';
  const source=path.join(directory,'source.'+extension);
  const output=path.join(directory,'marked.'+extension);
  try{
    await writeFile(source,new Uint8Array(await blob.arrayBuffer()));
    const args=['-nostdin','-hide_banner','-loglevel','error','-protocol_whitelist','file','-threads','2','-f',image?'mjpeg':'mov','-i',source,
      '-map','0:v:0','-map_metadata','-1','-filter_threads','1','-vf',
      'drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text=Earnly Studio:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6:x=w-tw-16:y=h-th-16'];
    if(image)args.push('-frames:v','1','-q:v','3');
    else args.push('-an','-t','5.1','-c:v','libx264','-threads','2','-preset','veryfast','-pix_fmt','yuv420p','-movflags','+faststart');
    await run('ffmpeg',[...args,output],{timeout:45000,maxBuffer:32768});
    const result=await readFile(output);
    if(result.length>32*1024*1024)throw Error('Processed media exceeds limit');
    return new Blob([result],{type:image?'image/jpeg':'video/mp4'});
  }finally{await rm(directory,{recursive:true,force:true});}
}
