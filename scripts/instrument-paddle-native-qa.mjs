import {readFile,writeFile} from 'node:fs/promises';

// Simulator-only passive diagnostics. Never included in the App Store build.
// Observe real input and the existing paddle; do not dispatch input, change
// physics, suppress timers, or manufacture a successful game state.
const path='paddlerally.html';
const script=`<script>
(() => {
  const probe=document.createElement('div');
  probe.style.cssText='position:fixed;bottom:0;left:0;font-size:8px;line-height:1.1;max-width:100%;pointer-events:none;z-index:9999';
  document.body.append(probe);
  // A modal result makes the rest of the page inert. Keep the observation in
  // the active dialog so a natural miss cannot hide a successful drag.
  new MutationObserver(()=>{
    const parent=document.querySelector('dialog[open]')||document.body;
    if(probe.parentNode!==parent)parent.append(probe);
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  let moved=false,events=0,history=[];
  const report=(event) => {
    const state={event:event?.type||'ready',target:event?.target?.id||'',x:event?.clientX??event?.changedTouches?.[0]?.clientX,paddle:paddle.x,running,starting,paused};
    if(event && /^(pointer|touch)/.test(event.type)) {
      events++;
      if(running && !paused && Math.abs(paddle.x-132)>30)moved=true;
    }
    history.push(state);if(history.length>18)history.shift();
    probe.textContent='Paddle probe moved='+(moved?'yes':'no')+' events='+events+' '+JSON.stringify(history);
    console.log('PADDLE_NATIVE_PROBE '+JSON.stringify(state));
  };
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','pause','resume','visibilitychange']) {
    document.addEventListener(type,event=>setTimeout(()=>report(event),0),{capture:true,passive:true});
  }
  report();
})();
</script>`;
await writeFile(path,(await readFile(path,'utf8')).replace('</body>',script+'\n</body>'));
