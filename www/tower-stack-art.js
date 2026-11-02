/* Architectural canvas artwork. All coordinates remain in the 360 × 560 game world. */
window.TowerStackArt=(()=>{
  let skyKey='',sky=null;
  function background(ctx,zone,camera){
    if(skyKey!==zone.sky){
      skyKey=zone.sky;sky=document.createElement('canvas');sky.width=720;sky.height=1120;
      const g=sky.getContext('2d');g.scale(2,2);
      const wash=g.createLinearGradient(0,0,180,560);wash.addColorStop(0,'#070e24');wash.addColorStop(.4,zone.sky);wash.addColorStop(1,'#244763');g.fillStyle=wash;g.fillRect(0,0,360,560);
      const halo=g.createRadialGradient(282,105,5,282,105,125);halo.addColorStop(0,'#b7dfff24');halo.addColorStop(1,'#b7dfff00');g.fillStyle=halo;g.fillRect(145,0,215,260);
      for(let i=0;i<65;i++){g.fillStyle=i%4?'#cfe8ff45':'#ffffffa0';const size=i%9===0?1.4:.65;g.fillRect((i*83+17)%360,(i*47+23)%340,size,size)}
      g.fillStyle='#d8e7ed';g.beginPath();g.arc(282,105,13,0,Math.PI*2);g.fill();
      g.fillStyle='#97b5c34a';for(const [x,y,r]of [[279,101,3],[286,110,4],[275,109,2]]){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill()}
      for(let i=0;i<5;i++){const y=155+i*64;const mist=g.createLinearGradient(0,y,360,y+26);mist.addColorStop(0,'#b7d8ee00');mist.addColorStop(.5,'#b7d8ee0b');mist.addColorStop(1,'#b7d8ee00');g.fillStyle=mist;g.beginPath();g.ellipse(50+i*59,y,150,9+i*2,-.12,0,Math.PI*2);g.fill()}
    }
    ctx.drawImage(sky,0,0,360,560);
    for(let layer=0;layer<3;layer++){
      const horizon=510+Math.min(260,camera*(.06+layer*.045));
      const step=layer===2?59:35;
      for(let i=0;i<Math.ceil(360/step)+1;i++){
        const x=i*step-20+layer*11,w=step-7,h=55+(i*43+layer*37)%135,y=horizon-h;
        if(y>560)continue;
        ctx.fillStyle=['#23405a','#172f48','#0d2238'][layer];ctx.fillRect(x,y,w,h+80);
        ctx.fillStyle=['#294b64','#21445a','#18394d'][layer];ctx.fillRect(x+3,y-5,w-7,5);
        if(i%3===0){ctx.fillRect(x+w*.6,y-20,1,15);ctx.fillStyle='#ffba9770';ctx.fillRect(x+w*.6,y-21,1.5,1.5)}
        for(let row=0;row<Math.ceil(h/12);row++)for(let col=0;col<Math.floor(w/7);col++){
          const seed=(row*17+col*13+i*7+layer*11)%11;
          ctx.fillStyle=seed<3?'#f4d29a75':seed<6?'#8ac9e23a':'#050f202a';ctx.fillRect(x+4+col*7,y+9+row*12,2.5,4);
        }
        ctx.fillStyle='#75bfd91c';ctx.fillRect(x,y,1,h);
      }
    }
    const fog=ctx.createLinearGradient(0,425,0,560);fog.addColorStop(0,'#1c4b6100');fog.addColorStop(1,'#21485a65');ctx.fillStyle=fog;ctx.fillRect(0,425,360,135);
  }
  function floor(ctx,block,y){
    const {x,w,color}=block;if(y>585||y+28<0||w<=0)return;
    const bevel=Math.min(5,w/4);
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,32);ctx.clip();
    ctx.fillStyle='#02081888';ctx.fillRect(x+2,y+27,w,4);
    // A thin stone roof, metal cornice, and recessed curtain-wall glazing.
    const roof=ctx.createLinearGradient(0,y,0,y+7);roof.addColorStop(0,'#c0d0d9');roof.addColorStop(1,'#58758c');ctx.fillStyle=roof;
    ctx.beginPath();ctx.moveTo(x,y+6);ctx.lineTo(x+bevel,y);ctx.lineTo(x+w-bevel,y);ctx.lineTo(x+w,y+6);ctx.closePath();ctx.fill();
    ctx.fillStyle='#d7e9edb0';ctx.fillRect(x+bevel,y+1,Math.max(0,w-2*bevel),.7);
    ctx.fillStyle='#0a182a';ctx.fillRect(x,y+6,w,21);
    const glass=ctx.createLinearGradient(x,y,x+w,y+28);glass.addColorStop(0,'#27516b');glass.addColorStop(.35,'#153048');glass.addColorStop(.58,'#3f6c80');glass.addColorStop(1,'#102236');ctx.fillStyle=glass;ctx.fillRect(x+2,y+8,Math.max(0,w-4),16);
    const count=Math.max(1,Math.floor((w-7)/13)),cell=(w-6)/count;
    for(let i=0;i<count;i++){
      const px=x+3+i*cell,lit=((block.floor||0)*7+i*11)%9<3;
      if(lit){const light=ctx.createLinearGradient(0,y+9,0,y+23);light.addColorStop(0,'#ffe2a3b5');light.addColorStop(1,'#c5955940');ctx.fillStyle=light;ctx.fillRect(px+1,y+9,Math.max(0,cell-3),13)}
      ctx.fillStyle='#081626';ctx.fillRect(px,y+7,1.5,18);ctx.fillStyle='#7ba2ad55';ctx.fillRect(px+1.5,y+8,.6,16);
    }
    ctx.fillStyle='#e7f5fb20';ctx.beginPath();ctx.moveTo(x+w*.25,y+8);ctx.lineTo(x+w*.42,y+8);ctx.lineTo(x+w*.31,y+24);ctx.lineTo(x+w*.14,y+24);ctx.closePath();ctx.fill();
    ctx.fillStyle='#142c40';ctx.fillRect(x,y+16,w,1);ctx.fillStyle='#8ba7b4';ctx.fillRect(x,y+25,w,2);
    ctx.fillStyle=color;ctx.fillRect(x,y+6,w,1.5);ctx.fillStyle=color+'60';ctx.fillRect(x,y+24,w,1);
    ctx.fillStyle='#06142699';ctx.fillRect(x+w-bevel,y+7,bevel,18);ctx.fillStyle='#d7f4ff50';ctx.fillRect(x,y+8,1,16);
    // Occasional floor markers feel architectural instead of numbering every bar.
    if(w>65&&block.floor>0&&block.floor%5===0){ctx.fillStyle='#08182ee0';ctx.fillRect(x+w/2-10,y+10,20,12);ctx.fillStyle='#e7edf0';ctx.font='600 7px system-ui';ctx.textAlign='center';ctx.fillText(String(block.floor).padStart(2,'0'),x+w/2,y+19)}
    ctx.restore();
  }
  return {background,floor};
})();
