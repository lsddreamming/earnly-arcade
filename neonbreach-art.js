/* Original, locally drawn Sector 07 materials. Build once; reuse during combat. */
(()=>{
  'use strict';
  const TAU=Math.PI*2,TEX=256;
  function surface(w=TEX,h=w){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas}
  function polygon(c,points,fill,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke()}}
  function gradient(c,x,y,w,h,colors){const g=c.createLinearGradient(x,y,x+w,y+h);colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color));return g}
  function bolt(c,x,y){c.fillStyle='#050d16';c.beginPath();c.arc(x,y,3,0,TAU);c.fill();c.fillStyle='#7c97a7';c.fillRect(x-1,y-2,2,2)}
  function glow(c,x,y,w,h,color){c.shadowColor=color;c.shadowBlur=10;c.fillStyle=color;c.fillRect(x,y,w,h);c.shadowBlur=0;c.fillStyle='#efffff';c.globalAlpha=.6;c.fillRect(x,y,w,Math.max(1,h*.25));c.globalAlpha=1}
  function wallTexture(kind){
    const canvas=surface(),c=canvas.getContext('2d');
    c.fillStyle=gradient(c,0,0,256,60,['#162432','#536473','#263746','#101e2b']);c.fillRect(0,0,256,256);
    // Deterministic brushed metal, with shallow scratches rather than noisy pixels.
    for(let y=0;y<256;y+=3){c.fillStyle=y%9?'#c3d6db07':'#02070e20';c.fillRect(0,y,256,1)}
    c.fillStyle='#08131e';c.fillRect(12,37,232,184);
    polygon(c,[[20,42],[230,42],[239,52],[239,209],[229,220],[20,220]],gradient(c,0,40,210,160,['#344756','#172834','#304453']),'#69818c');
    c.fillStyle='#0c1924';c.fillRect(23,127,212,4);c.fillStyle='#5d7580';c.fillRect(24,132,210,1);
    c.fillStyle='#738e9b';c.fillRect(0,0,256,3);c.fillStyle='#08131c';c.fillRect(0,253,256,3);
    for(const x of [4,246]){c.fillStyle='#0b1824';c.fillRect(x,0,6,256);c.fillStyle='#6a8392';c.fillRect(x,0,1,256)}
    c.fillStyle='#030b12';c.fillRect(17,13,222,12);glow(c,27,16,202,4,kind===2?'#ffb853':'#74e5f2');
    c.fillStyle='#070e16';c.fillRect(16,234,224,9);glow(c,29,237,198,2,kind===2?'#ffb853':'#339baa');
    for(const x of [25,231])for(const y of [48,121,141,211])bolt(c,x,y);
    if(kind===0){
      // Recessed air intake with individual louvers and a service label.
      c.fillStyle='#080f16';c.fillRect(45,65,164,48);
      for(let y=68;y<111;y+=7){c.fillStyle='#627783';c.fillRect(49,y,156,2);c.fillStyle='#243544';c.fillRect(49,y+2,156,3)}
      c.fillStyle='#14212c';c.fillRect(46,151,163,40);c.strokeStyle='#47616f';c.strokeRect(46,151,163,40);
      c.fillStyle='#afc4cc';c.font='bold 13px monospace';c.fillText('SECTOR / 07',58,169);c.fillStyle='#6d8795';c.font='7px monospace';c.fillText('ATMOSPHERE CONTROL',58,183);
      for(let i=0;i<3;i++)glow(c,178+i*8,201,3,3,i===2?'#ffbd6e':'#61dcce');
    }else if(kind===1){
      // Armored structural panel, bevels and a recessed diagonal brace.
      polygon(c,[[43,58],[65,58],[210,202],[188,202]],'#09151f','#65808b');
      polygon(c,[[47,58],[58,58],[204,202],[193,202]],'#445b69');
      c.fillStyle='#08151e';c.fillRect(158,63,48,22);c.fillStyle='#93b1bb';c.font='bold 11px monospace';c.fillText('B-07',166,78);
      for(const y of [156,166,176]){c.fillStyle='#0a1620';c.fillRect(47,y,54,4);c.fillStyle='#657b85';c.fillRect(47,y+4,54,1)}
      glow(c,194,109,4,54,'#61d9e8');
    }else if(kind===2){
      c.fillStyle='#0a1119';c.fillRect(43,57,170,151);
      for(const x of [49,135]){c.fillStyle=gradient(c,x,0,70,0,['#243541','#56616a','#283642']);c.fillRect(x,61,73,140)}
      c.fillStyle='#03080d';c.fillRect(125,57,7,151);
      for(const x of [111,139]){c.fillStyle='#7c8c90';c.fillRect(x,112,6,37);c.fillStyle='#111a20';c.fillRect(x+1,115,3,30)}
      c.save();c.beginPath();c.rect(45,188,166,16);c.clip();c.fillStyle='#b78235';c.fillRect(45,188,166,16);
      for(let x=28;x<230;x+=24)polygon(c,[[x,204],[x+14,204],[x+30,188],[x+16,188]],'#111b24');c.restore();
      c.fillStyle='#edc780';c.font='bold 9px monospace';c.fillText('LOCKED / 07',87,81);
      glow(c,69,222,118,3,'#f8b356');
    }else{
      c.fillStyle='#070f1a';c.fillRect(42,55,173,149);c.strokeStyle='#657986';c.strokeRect(42,55,173,149);
      c.fillStyle=gradient(c,0,60,0,138,['#104057','#051422']);c.fillRect(51,63,154,133);
      for(let y=68;y<193;y+=8){c.fillStyle='#75d7e611';c.fillRect(52,y,152,1)}
      c.strokeStyle='#64e9e5';c.lineWidth=2;c.beginPath();c.moveTo(60,132);for(let i=0;i<12;i++)c.lineTo(60+i*12,132+Math.sin(i*1.7)*18);c.stroke();
      c.fillStyle='#b0e4e6';c.font='bold 10px monospace';c.fillText('REACTOR 07',62,84);c.fillStyle='#55a1b7';c.font='7px monospace';c.fillText('SYSTEM / ONLINE',62,99);
      for(let i=0;i<6;i++){c.fillStyle=i<4?'#5bcfc8':'#163f4d';c.fillRect(63+i*21,172,15,7)}
      glow(c,112,214,32,3,'#55ddcc');
    }
    return canvas;
  }
  function planeTexture(ceiling){
    const canvas=surface(),c=canvas.getContext('2d');
    c.fillStyle=ceiling?'#202e3d':'#283b4a';c.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=4){c.fillStyle=y%12?'#cde3e503':'#060c1315';c.fillRect(0,y,256,1)}
    c.strokeStyle='#0c1925';c.lineWidth=5;c.strokeRect(2,2,252,252);c.strokeStyle='#66808a';c.lineWidth=1;c.strokeRect(7,7,242,242);
    if(ceiling){
      c.fillStyle='#0b1724';c.fillRect(23,39,210,177);c.fillStyle='#2d4150';c.fillRect(29,43,198,168);
      for(let i=0;i<5;i++){c.fillStyle='#132635';c.fillRect(40,65+i*26,176,9);c.fillStyle='#637581';c.fillRect(40,65+i*26,176,2)}
      glow(c,34,23,188,7,'#a5e8f0');
    }else{
      c.strokeStyle='#71899222';c.strokeRect(21,21,214,214);
      for(const x of [17,239])for(const y of [17,239])bolt(c,x,y);
      for(let x=38;x<218;x+=16){c.fillStyle='#05172140';c.fillRect(x,44,5,6);c.fillRect(x,206,5,6)}
      c.fillStyle='#82b4bc';c.fillRect(112,5,32,2);c.fillRect(5,112,2,32);
    }
    // Prefilter distant surfaces so ceiling slats and floor seams do not shimmer.
    const levels=[];
    for(let size=256;size>=1;size/=2){const mip=surface(size),mc=mip.getContext('2d');mc.drawImage(canvas,0,0,size,size);levels.push({size,data:mc.getImageData(0,0,size,size).data})}
    return levels;
  }
  function robotFrame(type,elite,frame){
    const canvas=surface(320,320),c=canvas.getContext('2d');c.scale(240,240);c.translate(.666,.15);
    const tank=type==='tank',sentry=type==='sentry',accent=elite?'#ffc36b':tank?'#bba0ff':sentry?'#ff7fbf':'#5ceafa';
    const step=Math.sin(frame/8*TAU),arm=step*.018;
    const steel=gradient(c,-.3,.1,.6,.6,['#b0c0c6','#647c8d','#2b4056','#112238']);
    const armor=gradient(c,-.3,.15,.6,.5,tank?['#8f93b0','#555872','#252d46']:['#a4b8c4','#536e83','#223a51']);
    const dark=gradient(c,0,0,.2,.3,['#405063','#111b2a']);
    c.lineWidth=.006;
    const plate=(p,fill=armor,edge='#8399a8')=>polygon(c,p,fill,edge);
    const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
    const ring=(x,y,r,fill,stroke)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke()}};
    function light(x,y,w,h){c.shadowColor=accent;c.shadowBlur=8;rect(x,y,w,h,accent);c.shadowBlur=0;rect(x,y,w,h*.23,'#e5ffff')}
    if(tank)c.scale(1.18,1);else if(!sentry)c.scale(.86,1);
    // Exposed hip bearings, opposing pistons, armored knees and weighted boots.
    plate([[-.17,.62],[.17,.62],[.19,.72],[.08,.77],[-.08,.77],[-.19,.72]],dark);
    for(const side of [-1,1]){
      c.save();c.translate(side*.15,step*side*.022);
      ring(0,.72,.062,'#101c29','#687e8c');rect(-.037,.74,.074,.17,'#112030');rect(-.014,.74,.025,.15,'#b4c6cc');
      plate([[-.072,.76],[.065,.76],[.074,.85],[.05,.94],[-.065,.94]],steel);
      plate([[-.073,.77],[.07,.77],[.06,.823],[-.068,.84]],armor);light(-.045,.79,.085,.012);
      plate([[-.065,.92],[.068,.92],[.1,.985],[.08,1.012],[-.11,1.012],[-.11,.975]],dark);
      plate([[-.065,.93],[.062,.93],[.08,.967],[-.098,.967]],steel);rect(-.1,.996,.18,.016,'#080e16');
      c.restore();
    }
    c.translate(0,Math.abs(step)*.009);
    // Rear cooling fins and a spine remain visible outside the front chest armor.
    rect(-.235,.25,.47,.35,'#122134');
    for(const side of [-1,1]){
      for(let j=0;j<3;j++)plate([[side*.22,.28+j*.056],[side*.3,.28+j*.056],[side*.29,.31+j*.056],[side*.22,.31+j*.056]],dark);
      c.save();c.translate(side*(tank?.32:.285),arm*side);
      ring(0,.35,.07,'#102030','#97aab3');rect(-.043,.36,.086,.21,'#14243a');rect(-.014,.37,.028,.17,'#b7c8ce');
      plate([[-.086,.275],[.064,.26],[.095,.295],[.086,.4],[-.091,.393]],steel);
      plate([[-.085,.285],[.055,.274],[.076,.306],[-.087,.322]],armor);light(-.055,.331,.104,.014);
      ring(0,.49,.052,'#0e1a2c','#7d95a6');
      if(sentry){
        plate([[-.081,.475],[.069,.475],[.095,.66],[-.093,.66]],dark);
        rect(-.069,.49,.138,.033,'#8a9da8');rect(-.054,.52,.108,.1,'#35495d');
        ring(0,.622,.065,'#0a111f','#8095a3');ring(0,.622,.044,'#273952',accent);ring(0,.622,.021,accent);ring(0,.622,.009,'#fff2ed');
      }else{
        plate([[-.062,.51],[.073,.51],[.079,.63],[-.071,.65]],armor);light(-.038,.536,.076,.014);
        plate([[-.069,.64],[.06,.64],[.07,.7],[-.06,.714]],dark);for(let j=0;j<3;j++)rect(-.041+j*.031,.66,.015,.024,'#8b9fac');
      }
      if(tank){plate([[-.125,.253],[.11,.253],[.13,.31],[.11,.363],[-.13,.363]],armor);light(-.085,.278,.17,.017)}
      c.restore();
    }
    plate([[-.215,.29],[.21,.29],[.264,.365],[.213,.625],[.14,.71],[-.14,.71],[-.22,.625],[-.26,.365]],dark);
    for(const side of [-1,1]){
      plate([[side*.014,.31],[side*.20,.30],[side*.24,.357],[side*.20,.475],[side*.068,.46],[side*.04,.405]],steel);
      plate([[side*.032,.321],[side*.20,.315],[side*.215,.344],[side*.068,.369]],armor);
      plate([[side*.09,.496],[side*.203,.48],[side*.181,.594],[side*.08,.632]],armor);
      for(let j=0;j<3;j++)rect(side*.141-.025,.525+j*.025,.05,.009,'#102030');
      ring(side*.204,.384,.009,'#dde5e4');
    }
    // Recessed reactor with concentric machined housing and an energy aperture.
    ring(0,.471,tank?.103:.081,'#050e1a','#91aab7');ring(0,.471,tank?.082:.064,'#334a60',accent);
    c.shadowColor=accent;c.shadowBlur=13;ring(0,.471,tank?.057:.043,accent);c.shadowBlur=0;
    ring(0,.471,.025,'#e7ffff');rect(-.007,.435,.014,.071,'#f4ffff');
    for(let j=0;j<3;j++)plate([[-.095,.59+j*.03],[.095,.59+j*.03],[.08,.61+j*.03],[-.08,.61+j*.03]],steel);
    rect(-.056,.237,.112,.061,'#142135');rect(-.031,.24,.062,.038,'#93a8b3');
    if(sentry){
      plate([[-.147,.057],[.13,.04],[.181,.109],[.143,.229],[-.145,.232],[-.179,.126]],armor);
      plate([[-.152,.097],[.144,.082],[.149,.171],[-.157,.185]],'#06111e');
      ring(0,.139,.054,'#293d51','#c5b5c7');c.shadowColor=accent;c.shadowBlur=9;ring(0,.139,.034,accent);c.shadowBlur=0;ring(-.006,.132,.014,'#fff7fb');
      rect(-.083,.212,.154,.012,'#a2b5bd');rect(.134,-.04,.012,.13,'#748fa1');light(.122,-.048,.036,.024);
    }else{
      plate([[-.184,.051],[-.108,.001],[.123,.012],[.194,.066],[.168,.224],[.08,.257],[-.102,.246],[-.177,.197]],steel);
      plate([[-.179,.075],[-.105,.019],[.124,.03],[.18,.076],[.125,.09],[-.122,.093]],armor);
      plate([[-.163,.096],[.151,.096],[.143,.158],[-.155,.163]],'#050d18','#536d7d');
      if(tank){light(-.124,.116,.247,.023);plate([[-.09,.17],[.092,.167],[.102,.223],[-.082,.226]],dark);for(let i=0;i<5;i++)rect(-.064+i*.03,.178,.013,.037,'#8199a8')}
      else{plate([[-.13,.11],[-.026,.12],[-.041,.144],[-.127,.137]],accent);plate([[.13,.11],[.026,.12],[.041,.144],[.127,.137]],accent);plate([[-.06,.185],[0,.161],[.065,.184],[.046,.234],[-.042,.234]],dark);light(-.04,.203,.08,.008)}
      for(const side of [-1,1]){plate([[side*.165,.082],[side*.208,.084],[side*.202,.19],[side*.166,.197]],dark);light(side*.19-.01,.117,.018,.038)}
    }
    if(elite){plate([[-.06,.023],[0,-.068],[.06,.025]],'#73502c',accent);light(-.069,.684,.138,.017)}
    return canvas;
  }
  function lampTexture(color){
    const canvas=surface(384,320),c=canvas.getContext('2d'),x=192,top=20,bottom=280,radius=162;
    c.save();c.beginPath();c.moveTo(x-37,top);c.lineTo(x+37,top);c.lineTo(x+radius,bottom);c.lineTo(x-radius,bottom);c.closePath();c.clip();
    const beam=c.createLinearGradient(x-radius,0,x+radius,0);beam.addColorStop(0,color+'00');beam.addColorStop(.5,color+'0e');beam.addColorStop(1,color+'00');c.fillStyle=beam;c.fillRect(x-radius,top,radius*2,bottom-top);c.restore();
    c.save();c.translate(x,bottom);c.scale(1,.18);const pool=c.createRadialGradient(0,0,0,0,0,radius);pool.addColorStop(0,color+'22');pool.addColorStop(1,color+'00');c.fillStyle=pool;c.fillRect(-radius,-radius,radius*2,radius*2);c.restore();
    c.fillStyle='#071623';c.fillRect(x-51,top-2,102,5);c.fillStyle=color;c.fillRect(x-37,top,74,1.5);
    return canvas;
  }
  const lamps=new Map();
  let materials;
  function create(){
    if(!materials)materials={walls:[0,1,2,3].map(wallTexture),floor:planeTexture(false),ceiling:planeTexture(true)};
    const robots=new Map();
    return {...materials,lamp(color){if(!lamps.has(color))lamps.set(color,lampTexture(color));return lamps.get(color)},robot(type,elite,frame){const key=`${type}-${!!elite}-${frame}`;if(!robots.has(key))robots.set(key,robotFrame(type,elite,frame));return robots.get(key)}};
  }
  window.NeonBreachArt={create};
})();
