/* Presentation only: combat keeps its existing 330 × 480 logical coordinates. */
(function(root){
  'use strict';
  const TAU=Math.PI*2;
  function projection(width,height,top=0,bottom=0,immersive=false){
    const available=Math.max(120,height-top-bottom);
    const w=immersive?Math.min(width-24,available*1.35,760):width;
    return {x:(width-w)/2,y:top,w,h:available,sx:w/330,sy:available/480};
  }
  function create(canvas){
    const ctx=canvas.getContext('2d'),backdrop=document.createElement('canvas'),bg=backdrop.getContext('2d');
    const sprites=new Map();
    const stars=Array.from({length:110},(_,i)=>({x:((i*97+43)%997)/997,y:((i*173+17)%991)/991,z:1+i%3}));
    let width=330,height=480,dpr=1,view=projection(width,height),immersive=false;
    const path=(c,points,fill,stroke)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.7;c.stroke();}};
    function paintBackdrop(){
      backdrop.width=Math.ceil(width*dpr);backdrop.height=Math.ceil(height*dpr);bg.setTransform(dpr,0,0,dpr,0,0);
      const space=bg.createLinearGradient(0,0,width,height);space.addColorStop(0,'#061322');space.addColorStop(.45,'#07162b');space.addColorStop(1,'#160e29');bg.fillStyle=space;bg.fillRect(0,0,width,height);
      for(const [x,y,r,color] of [[.85,.48,.65,'#27408866'],[.03,.76,.57,'#117d8266'],[.7,.93,.5,'#74275b33']]){
        const radius=Math.max(width,height)*r,g=bg.createRadialGradient(width*x,height*y,0,width*x,height*y,radius);g.addColorStop(0,color);g.addColorStop(1,'#00000000');bg.fillStyle=g;bg.fillRect(0,0,width,height);
      }
      // A softly lit gas giant sits behind the combat plane; the limb is brightest.
      const radius=Math.min(width*.43,height*.25),px=width*.12,py=height*.34;
      bg.save();bg.translate(px,py);bg.rotate(-.32);
      const halo=bg.createRadialGradient(0,0,radius*.85,0,0,radius*1.18);halo.addColorStop(0,'#00000000');halo.addColorStop(.72,'#58bedc25');halo.addColorStop(1,'#00000000');bg.fillStyle=halo;bg.beginPath();bg.arc(0,0,radius*1.18,0,TAU);bg.fill();
      bg.save();bg.beginPath();bg.arc(0,0,radius,0,TAU);bg.clip();
      const globe=bg.createRadialGradient(-radius*.58,-radius*.5,radius*.05,radius*.3,radius*.25,radius*1.35);globe.addColorStop(0,'#5199ad');globe.addColorStop(.38,'#246071');globe.addColorStop(.76,'#113348');globe.addColorStop(1,'#061424');bg.fillStyle=globe;bg.fillRect(-radius,-radius,radius*2,radius*2);
      for(let i=0;i<12;i++){bg.strokeStyle=i%2?'#9bc1b416':'#071c3330';bg.lineWidth=radius*(.025+i%3*.013);bg.beginPath();bg.ellipse(0,-radius+i*radius*.18,radius*1.2,radius*.12,0,0,TAU);bg.stroke();}
      const shade=bg.createLinearGradient(-radius,0,radius,0);shade.addColorStop(0,'#00000000');shade.addColorStop(.5,'#020a1522');shade.addColorStop(1,'#020916e8');bg.fillStyle=shade;bg.fillRect(-radius,-radius,radius*2,radius*2);bg.restore();
      bg.strokeStyle='#9cd9d23b';bg.lineWidth=Math.max(1,radius*.014);bg.beginPath();bg.ellipse(0,0,radius*1.75,radius*.28,.1,0,Math.PI);bg.stroke();bg.strokeStyle='#81b2c21b';bg.lineWidth=radius*.055;bg.stroke();bg.restore();
      const mx=width*.83,my=height*.19,mr=Math.min(width*.07,36);const moon=bg.createRadialGradient(mx-mr*.4,my-mr*.45,0,mx,my,mr);moon.addColorStop(0,'#8ca1b7');moon.addColorStop(.52,'#354b64');moon.addColorStop(1,'#0a172b');bg.fillStyle=moon;bg.beginPath();bg.arc(mx,my,mr,0,TAU);bg.fill();
      const vignette=bg.createRadialGradient(width*.5,height*.5,height*.1,width*.5,height*.5,Math.max(width,height)*.75);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#02061088');bg.fillStyle=vignette;bg.fillRect(0,0,width,height);
    }
    function resize(options={}){
      const box=canvas.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);dpr=Math.max(1,Math.min(2,root.devicePixelRatio||1));immersive=!!options.immersive;
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      view=projection(width,height,options.top||0,options.bottom||0,immersive);paintBackdrop();
      return {...view,dpr,width,height};
    }
    function sprite(kind,color,accent){
      const key=kind+color+accent;if(sprites.has(key))return sprites.get(key);
      const art=document.createElement('canvas');art.width=256;art.height=256;const c=art.getContext('2d');c.scale(2,2);c.translate(64,64);
      if(kind==='player'){
        path(c,[[-23,15],[-13,-5],[0,-28],[13,-5],[23,15],[9,12],[0,20],[-9,12]],'#06111e');
        const metal=c.createLinearGradient(-22,-15,22,21);metal.addColorStop(0,accent);metal.addColorStop(.38,color);metal.addColorStop(1,'#153951');
        path(c,[[0,-29],[10,-7],[24,13],[10,8],[0,16],[-10,8],[-24,13]],metal,'#d9ffff77');
        path(c,[[-9,-6],[-24,13],[-11,8],[-5,-1]],color);path(c,[[9,-6],[24,13],[11,8],[5,-1]],'#142b4f99');
        path(c,[[0,-27],[7,5],[0,13],[-7,5]],accent);path(c,[[0,-26],[0,13],[7,5]],'#16416499');
        const glass=c.createLinearGradient(-4,-17,5,1);glass.addColorStop(0,'#d5ffff');glass.addColorStop(.35,'#4ed9ed');glass.addColorStop(1,'#17496c');
        c.fillStyle=glass;c.beginPath();c.ellipse(0,-8,4,9,0,0,TAU);c.fill();
        for(const x of [-12,12]){c.fillStyle='#133049';c.fillRect(x-3,7,6,9);c.fillStyle='#bcffff';c.fillRect(x-2,10,4,4);c.fillStyle='#60e7ed';c.fillRect(x<0?-22:19,10,3,2);}
      }else if(kind==='commander'){
        path(c,[[-43,7],[-27,-12],[-14,-17],[0,-12],[14,-17],[27,-12],[43,7],[27,20],[12,16],[0,23],[-12,16],[-27,20]],'#1a142e');
        const hull=c.createLinearGradient(-35,-14,32,20);hull.addColorStop(0,'#d9aedf');hull.addColorStop(.4,'#8c599b');hull.addColorStop(1,'#352b59');
        path(c,[[-43,3],[-27,-16],[-14,-21],[0,-16],[14,-21],[27,-16],[43,3],[27,16],[12,12],[0,19],[-12,12],[-27,16]],hull,'#ffceee77');
        path(c,[[-38,3],[-22,-4],[-12,11],[-27,13]],'#322243');path(c,[[38,3],[22,-4],[12,11],[27,13]],'#231e3a');
        path(c,[[0,-15],[15,-2],[9,12],[0,18],[-9,12],[-15,-2]],'#ad73b6');path(c,[[0,-15],[0,18],[9,12],[15,-2]],'#51365f');
        c.fillStyle='#ffbd87';c.shadowBlur=8;c.shadowColor='#ff599c';for(const x of [-26,-17,17,26]){c.fillRect(x-2,-4,4,5);}c.shadowBlur=0;
        c.fillStyle='#fff1b3';c.beginPath();c.ellipse(0,1,5,6,0,0,TAU);c.fill();
      }else{
        const armored=kind==='armored';const shape=armored?[[-20,0],[-12,-12],[12,-12],[20,0],[14,14],[0,18],[-14,14]]:[[-19,5],[-11,-9],[0,-14],[11,-9],[19,5],[9,8],[0,15],[-9,8]];
        c.save();c.translate(1,4);path(c,shape,'#151128');c.restore();
        const hull=c.createLinearGradient(-14,-12,15,15);hull.addColorStop(0,armored?'#f3c99c':'#f2d7ff');hull.addColorStop(.42,color);hull.addColorStop(1,'#302044');path(c,shape,hull,'#ffe0ff66');
        path(c,[[0,-12],[9,0],[5,10],[0,15],[-5,10],[-9,0]],'#382447');path(c,[[0,-12],[0,15],[5,10],[9,0]],'#201e38');
        c.fillStyle='#ffd29c';c.beginPath();c.ellipse(0,-1,5,3,0,0,TAU);c.fill();c.fillStyle='#ff73c1';for(const x of [-12,12]){c.fillRect(x-2,5,4,5);}
        if(armored){c.strokeStyle='#ffda9b';c.lineWidth=2;c.beginPath();c.moveTo(-14,-6);c.lineTo(-17,1);c.lineTo(-12,10);c.moveTo(14,-6);c.lineTo(17,1);c.lineTo(12,10);c.stroke();}
      }
      sprites.set(key,art);return art;
    }
    const craft=(art,x,y,size,angle=0,alpha=1)=>{ctx.save();ctx.translate(view.x+x*view.sx,view.y+y*view.sy);ctx.rotate(angle);ctx.globalAlpha=alpha;ctx.drawImage(art,-64*size,-64*size,128*size,128*size);ctx.restore();};
    function draw(s){
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.drawImage(backdrop,0,0,width,height);
      const time=s.reduced?0:s.elapsed,unit=Math.min(view.sx,view.sy*1.6),px=x=>view.x+x*view.sx,py=y=>view.y+y*view.sy;
      for(const star of stars){const y=(star.y*height+time*star.z*9)%height,x=star.x*width+(s.reduced?0:s.bank*star.z*9);ctx.globalAlpha=.22+star.z*.17;ctx.fillStyle=star.z===3?'#b6e8f8':'#7d9ebd';ctx.beginPath();ctx.ellipse(x,y,.45+star.z*.3,.45+star.z*.3,0,0,TAU);ctx.fill();}ctx.globalAlpha=1;
      // Distant orbital lanes establish depth without resembling playable boundaries.
      ctx.strokeStyle='#83d9ff0a';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(width*.6,height*.68,width*(.7+i*.19),height*.24,-.5,0,TAU);ctx.stroke();}
      for(const a of s.aliens){
        const x=px(a.x),y=py(a.y),r=(a.boss?44:22)*unit;
        if(a===s.warningAlien){ctx.strokeStyle='#ffbd7d';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();path(ctx,[[x-4,y+r+3],[x,y+r+9],[x+4,y+r+3]],'#ffbd7d');}
        craft(sprite(a.boss?'commander':a.maxHp>1?'armored':'scout',a.color,''),a.x,a.y,unit,s.reduced?0:Math.sin(a.phase)*.045,a.flash>0&&!s.reduced?.65:1);
        if(a.boss){ctx.fillStyle='#161128';ctx.fillRect(x-33*unit,y+29*unit,66*unit,4*unit);ctx.fillStyle='#ffb889';ctx.fillRect(x-33*unit,y+29*unit,66*unit*a.hp/a.maxHp,4*unit);}
      }
      for(const b of s.bullets){const x=px(b.x),y=py(b.y);ctx.fillStyle=s.rapid?'#fdd48944':'#7be6ff33';ctx.fillRect(x-5*unit,y-12*unit,10*unit,24*unit);ctx.fillStyle=s.rapid?'#fff2bb':'#d2fbff';ctx.fillRect(x-1.6*unit,y-9*unit,3.2*unit,15*unit);}
      for(const b of s.enemyShots){const x=px(b.x),y=py(b.y);ctx.fillStyle='#ff559333';ctx.beginPath();ctx.arc(x,y,8*unit,0,TAU);ctx.fill();ctx.fillStyle='#ff91bd';ctx.beginPath();ctx.arc(x,y,4*unit,0,TAU);ctx.fill();ctx.fillStyle='#ffe3ef';ctx.beginPath();ctx.arc(x-unit,y-unit,1.5*unit,0,TAU);ctx.fill();}
      for(const p of s.particles){ctx.globalAlpha=Math.max(0,p.life/.45);ctx.fillStyle=p.color;ctx.fillRect(px(p.x),py(p.y),2.5*unit,2.5*unit);}ctx.globalAlpha=1;
      if(!s.reduced){for(const r of s.rings){ctx.globalAlpha=r.life/.5;ctx.strokeStyle=r.color;ctx.lineWidth=2*unit;ctx.beginPath();ctx.arc(px(r.x),py(r.y),(8+(1-r.life/.5)*28)*unit,0,TAU);ctx.stroke();}ctx.globalAlpha=1;ctx.font='800 '+Math.max(11,11*unit)+'px system-ui';ctx.textAlign='center';for(const p of s.scorePops){ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillStyle=p.color;ctx.fillText(p.text,px(p.x),py(p.y));}ctx.globalAlpha=1;}
      const x=px(s.shipX),y=py(426),flame=s.reduced?19:22+Math.sin(time*31)*4;
      ctx.save();ctx.translate(x,y);ctx.rotate(s.reduced?0:s.bank);ctx.scale(unit,unit);
      for(const offset of [-12,12]){const glow=ctx.createLinearGradient(0,12,0,12+flame);glow.addColorStop(0,'#b5ffff');glow.addColorStop(.3,'#64dfeec0');glow.addColorStop(1,'#4b9eff00');path(ctx,[[offset-3,12],[offset+3,12],[offset+5,12+flame*.6],[offset,12+flame],[offset-5,12+flame*.6]],glow);}
      ctx.restore();
      if(s.shield){ctx.strokeStyle='#9ef8d4';ctx.lineWidth=1.8*unit;ctx.fillStyle='#77efdc12';ctx.beginPath();ctx.ellipse(x,y-2*unit,28*unit,34*unit,0,0,TAU);ctx.fill();ctx.stroke();}
      craft(sprite('player',s.livery.color,s.livery.accent),s.shipX,426,unit,s.reduced?0:s.bank,s.invincible>0?.55:1);
      if(!s.reduced&&s.damageTint>0){ctx.globalAlpha=s.damageTint;ctx.strokeStyle='#ff889f';ctx.lineWidth=8;ctx.strokeRect(4,4,width-8,height-8);ctx.globalAlpha=1;}
      if(!immersive){ctx.textAlign='center';ctx.font='900 23px system-ui';ctx.fillStyle='#effdff';ctx.fillText('DEFEND THE SECTOR',width/2,height*.55);ctx.font='12px system-ui';ctx.fillStyle='#b8d6e8';ctx.fillText('Drag to steer · your ship auto-fires',width/2,height*.55+25);}
    }
    return {resize,draw,boardX:clientX=>(clientX-canvas.getBoundingClientRect().left-view.x)/view.sx,layout:()=>({...view,dpr,width,height})};
  }
  root.StarDefenderScene={create,projection};
  if(typeof module==='object'&&module.exports)module.exports={projection};
})(typeof window==='undefined'?globalThis:window);
