/* Rear-facing seated avatar. Reuses owned catalog silhouettes and palettes;
   front-only facial features are deliberately hidden from the chase camera. */
window.TurboKartDriver=(()=>{
 const defaults={avatar:{id:'cyber-starter',imageUrl:'cosmetic-cyber-starter.svg'},outfit:{imageUrl:'cosmetic-starter-suit.svg'},hair:{imageUrl:'cosmetic-hair-sprout.svg'}};
 const bodies=new Set(['cyber-starter','neon-phantom','vortex-mech','astra-prime','russet-potato','cream-potato','rose-potato']);
 const cache=new Map();
 function asset(src,rear){
  if(!/^cosmetic-[a-z0-9-]+\.svg$/.test(src||''))return Promise.resolve(null);
  const key=src+rear;if(cache.has(key))return cache.get(key);
  const task=(async()=>{try{
   const res=await fetch(src);if(!res.ok)return null;const svg=await res.text();
   const img=new Image();img.src=src;await img.decode();
   const c=document.createElement('canvas');c.width=300;c.height=400;const x=c.getContext('2d');x.drawImage(img,0,0,300,400);
   if(rear){
    // Preserve each item's outline and its own material colors, but remove
    // front zippers, visors and chest emblems. A back seam gives depth.
    const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
    const id=src.includes('hair')?'hair':src.includes('suit')||src.includes('jacket')||src.includes('coat')?'cloth':null;
    const stops=[...(id?doc.querySelectorAll(`[id="${id}"] stop`):[])];
    const colors=(stops.length?stops:[...doc.querySelectorAll('linearGradient stop')]).map(n=>n.getAttribute('stop-color')).filter(v=>/^#[a-f0-9]{3,8}$/i.test(v||''));
    const g=x.createLinearGradient(40,0,260,0);g.addColorStop(0,colors[0]||'#64829a');g.addColorStop(.55,colors[1]||'#334658');g.addColorStop(1,colors.at(-1)||'#172635');
    x.globalCompositeOperation='source-atop';x.fillStyle=g;x.fillRect(0,0,300,400);x.strokeStyle='#ffffff30';x.lineWidth=3;x.beginPath();x.moveTo(150,30);x.lineTo(150,340);x.stroke();
   }return c;
  }catch{return null;}})();cache.set(key,task);return task;
 }
 async function compose(equipped=defaults){
  const e={...equipped},body=bodies.has(e.avatar?.id)?e.avatar.id:'cyber-starter';
  const parts=[['avatar',`cosmetic-${body}-body.svg`,false],...['outfit','shoes','hair','head','weapon','backpack','pet','effect'].filter(slot=>e[slot]).map(slot=>[slot,e[slot].imageUrl,['outfit','hair','head'].includes(slot)])];
  const loaded=await Promise.all(parts.map(async([slot,src,rear])=>({slot,src,image:await asset(src,rear)})));
  const c=document.createElement('canvas');c.width=300;c.height=400;const x=c.getContext('2d');for(const p of loaded)if(p.image)x.drawImage(p.image,0,0);
  return {canvas:c,parts:loaded.filter(p=>p.image).map(({slot,src})=>({slot,src}))};
 }
 return {compose,defaults};
})();
