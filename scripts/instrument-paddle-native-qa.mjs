import {readFile,writeFile} from 'node:fs/promises';

// Simulator-only passive diagnostics. Never included in the App Store build.
// Observe real input and the existing paddle; do not dispatch input, change
// physics, suppress timers, or manufacture a successful game state.
const path='paddlerally.html';
const script=`<script>
(() => {
  const probe=document.createElement('div');
  probe.style.cssText='position:fixed;top:0;left:0;font-size:1px;pointer-events:none;z-index:9999';
  document.body.append(probe);
  let moved=false,events=0;
  const report=(event) => {
    const state={event:event?.type||'ready',target:event?.target?.id||'',x:event?.clientX??event?.changedTouches?.[0]?.clientX,paddle:paddle.x,running,starting,paused};
    if(event && /^(pointer|touch)/.test(event.type)) {
      events++;
      if(running && !paused && Math.abs(paddle.x-132)>30)moved=true;
    }
    probe.textContent='Paddle probe moved='+(moved?'yes':'no')+' events='+events;
    console.log('PADDLE_NATIVE_PROBE '+JSON.stringify(state));
  };
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','pause','resume','visibilitychange']) {
    document.addEventListener(type,event=>setTimeout(()=>report(event),0),{capture:true,passive:true});
  }
  report();
})();
</script>`;
await writeFile(path,(await readFile(path,'utf8')).replace('</body>',script+'\n</body>'));
