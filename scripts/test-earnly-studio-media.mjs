import {markPilotMedia} from '../studio/media.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const run=promisify(execFile);
for(const kind of ['image','video']){
  const image=kind==='image';
  const args=['-hide_banner','-loglevel','error','-threads','1','-filter_threads','1','-f','lavfi','-i','color=c=blue:s=320x240:r=8:d=1'];
  if(image)args.push('-frames:v','1','-f','mjpeg');
  else args.push('-c:v','libx264','-threads','1','-movflags','frag_keyframe+empty_moov','-f','mp4');
  const {stdout}=await run('ffmpeg',[...args,'pipe:1'],{encoding:'buffer'});
  const result=await markPilotMedia(new Blob([stdout]),kind);
  assert.ok(result.size>0);
  assert.equal(result.type,image?'image/jpeg':'video/mp4');
  assert.notDeepEqual(Buffer.from(await result.arrayBuffer()),stdout);
}
console.log('PASS: JPEG and H.264 fixtures transcode with baked-in pilot watermark. No AI inference.');
