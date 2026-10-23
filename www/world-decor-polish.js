/* Original Earnly sculpted furniture. Static geometry is cached by the renderer;
   only a few small, local light/water details move. No simulation or network writes. */
(()=>{
 const models=new Set(['column','divider','theme-mask','theme-fan','theme-banana','theme-seat','theme-idol','theme-terrarium','theme-arch','theme-nest','theme-fruit','theme-bridge','theme-roses','theme-cauldron','theme-batseat','theme-potions','theme-gargoyle','theme-gate','theme-coffin','theme-stained','theme-organ','vanity','wardrobe','canopy-bed','easel','sewing-desk','tool-stand','crescent-light','listening-console','channel-sofa','season-lantern','season-patch','season-ghost','season-memorial','season-cauldron','season-flame','season-mirror','season-tub','season-web']);
 const animated=new Set(['theme-terrarium','theme-cauldron','theme-potions','crescent-light','listening-console','season-lantern','season-ghost','season-cauldron','season-flame','season-mirror','season-tub']);
 function build(s,g){
  if(!models.has(s))return false;
  const {block:b,detail:d,ribbon:line,foliage:leaf,cylinder:cy,ring,shade,color:c}=g;
  const wood='#986c49',gold='#d6b078',ink='#29364b',cream='#f4e7d0',green='#6b9b78',metal='#65758b';
  const line3=(p,t,w=.015)=>{for(let j=1;j<p.length;j++)line(p[j-1],p[j],t,w);};
  // Faceted, softly shaded volumes: clean silhouettes instead of outlined grids.
  const shape=(u,v,z,rx,ry,h,profile,tint,n=12)=>{
   for(let k=1;k<profile.length;k++)for(let j=0;j<n;j++){
    const a=j*2*Math.PI/n,q=(j+1)*2*Math.PI/n,[r0,z0]=profile[k-1],[r1,z1]=profile[k];
    d([[u+Math.cos(a)*rx*r0,v+Math.sin(a)*ry*r0,z+h*z0],[u+Math.cos(q)*rx*r0,v+Math.sin(q)*ry*r0,z+h*z0],[u+Math.cos(q)*rx*r1,v+Math.sin(q)*ry*r1,z+h*z1],[u+Math.cos(a)*rx*r1,v+Math.sin(a)*ry*r1,z+h*z1]],shade(tint,Math.round(Math.cos(a-.7)*13+k*3)));
   }
   const [lastR,lastZ]=profile[profile.length-1];if(lastR>0)d(Array.from({length:n},(_,j)=>{const a=j*2*Math.PI/n;return [u+Math.cos(a)*rx*lastR,v+Math.sin(a)*ry*lastR,z+h*lastZ];}),shade(tint,22));
  };
  const puff=(u,v,z,rx,ry,h,tint)=>shape(u,v,z,rx,ry,h,[[0,0],[.72,.15],[1,.48],[.82,.8],[0,1]],tint);
  const panel=(u,v,a,z,h,t)=>d([[u,v,z],[u+a,v,z],[u+a,v,z+h],[u,v,z+h]],t);
  const feet=(w=1,l=1,h=7)=>{for(const u of [.12,w-.22])for(const v of [.12,l-.22])b(u,v,.1,.1,h,0,wood);};
  const trim=(u,v,a,z,h,t=gold)=>{line3([[u,v,z],[u+a,v,z],[u+a,v,z+h],[u,v,z+h],[u,v,z]],t,.014);};
  const grain=(u,v,a,z,h)=>{for(let j=0;j<4;j++)line3([[u+a*(j+.3)/4,v,z],[u+a*(j+.45)/4,v,z+h*.45],[u+a*(j+.3)/4,v,z+h]],'#bd9267',.007);};
  const cushion=(u,v,a,l,z,t=c)=>{shape(u+a/2,v+l/2,z,a/2,l/2,5,[[.76,0],[1,.25],[.95,.75],[.72,1]],t);line3([[u+a*.15,v+l*.15,z+5.02],[u+a*.85,v+l*.15,z+5.02],[u+a*.85,v+l*.85,z+5.02]],shade(t,28),.008);};
  const flower=(u,v,z,t=c)=>{for(let j=0;j<5;j++){const a=j*1.256;puff(u+Math.cos(a)*.06,v+Math.sin(a)*.06,z,.07,.07,2.8,shade(t,j%2?16:-12));}cy(u,v,.035,z+2.8,.5,gold,8);};
  const bottle=(u,v,z,t)=>{shape(u,v,z,.085,.085,7,[[.65,0],[1,.15],[1,.6],[.4,.82],[.4,1]],t,8);cy(u,v,.04,z+7,1.6,gold,8);line([u-.025,v+.079,z+1],[u-.025,v+.079,z+5],cream,.01);};
  const pumpkin=(u,v,z,r,h,carved=false)=>{
   shape(u,v,z,r,r,h,[[.2,0],[.8,.12],[1,.45],[.86,.8],[.28,1]],c,16);
   for(let j=0;j<8;j++){const a=j*Math.PI/4;line3([[u+Math.cos(a)*r*.25,v+Math.sin(a)*r*.25,z+h],[u+Math.cos(a)*r*.86,v+Math.sin(a)*r*.86,z+h*.8],[u+Math.cos(a)*r,v+Math.sin(a)*r,z+h*.45],[u+Math.cos(a)*r*.8,v+Math.sin(a)*r*.8,z+h*.12]],'#c47a35',.009);}
   line3([[u,v,z+h],[u+.02,v,z+h+3],[u+.09,v,z+h+4]],'#6b7845',.035);leaf(u,v,z+h,.18,.08,1,green);
   if(carved){for(const side of [-1,1]){const x=u+side*r*.38;d([[x-r*.18,v+r*.94,z+h*.61],[x+r*.18,v+r*.94,z+h*.61],[x,v+r*.94,z+h*.8]],ink);d([[x-r*.09,v+r*.955,z+h*.63],[x+r*.09,v+r*.955,z+h*.63],[x,v+r*.955,z+h*.72]],'#ffe8a4');}line3([[u-r*.5,v+r*.94,z+h*.43],[u-r*.25,v+r*.99,z+h*.3],[u,v+r*.99,z+h*.35],[u+r*.25,v+r*.99,z+h*.3],[u+r*.5,v+r*.94,z+h*.43]],ink,.028);}
  };
  const cauldron=(season)=>{
   for(const [u,v]of [[.22,.25],[.78,.25],[.5,.8]])b(u-.04,v-.04,.09,.09,7,0,ink);
   shape(.5,.5,5,.42,.42,18,[[.5,0],[.95,.2],[1,.55],[.8,1]],season?c:'#526274');
   cy(.5,.5,.34,22,2.5,gold);cy(.5,.5,.29,24.6,.3,'#7bcfa9');ring(.5,.5,.3,25,'#d0ffe0');
   for(const u of [.04,.96])line3([[u,.4,17],[u,.3,20],[u,.18,17],[u,.4,13],[u,.4,17]],gold,.035);
   for(const u of [.28,.5,.72])panel(u,.882,.035,11,4,shade(c,35));
   if(season)line([.68,.4,18],[.83,.3,34],wood,.035);
  };
  switch(s){
   case 'column':b(.08,.08,.84,.84,4,0,shade(c,-15));cy(.5,.5,.31,4,5,c);cy(.5,.5,.22,9,42,c);for(let j=0;j<12;j++){const a=j*Math.PI/6;line([.5+Math.cos(a)*.224,.5+Math.sin(a)*.224,12],[.5+Math.cos(a)*.224,.5+Math.sin(a)*.224,49],shade(c,-25),.008);}cy(.5,.5,.3,51,4,c);b(.08,.08,.84,.84,3,55,shade(c,15));break;
   case 'divider':for(let j=0;j<3;j++){const u=j*.66,v=j%2?.4:.3;b(u,v,.62,.12,35,5,c);panel(u+.07,v+.125,.48,9,27,'#8ca58e');trim(u+.06,v+.14,.5,8,29,gold);for(let k=0;k<7;k++)line([u+.09,v+.15,11+k*3.5],[u+.52,v+.15,11+k*3.5],'#c4ceab',.009);for(const x of [u,u+.53])b(x,v-.05,.09,.27,5,0,wood);}break;
   case 'season-lantern':cy(.5,.5,.43,0,2,ink);pumpkin(.5,.5,2,.4,23,true);break;
   case 'season-patch':b(.04,.04,1.92,1.92,2,0,'#655e49');for(let j=0;j<6;j++)line([.12,.2+j*.3,2.1],[1.88,.2+j*.3,2.1],'#8e7960',.02);for(const [u,v,r,h]of [[.5,.45,.34,17],[1.4,.55,.37,19],[.65,1.4,.34,16],[1.5,1.45,.26,13]]){pumpkin(u,v,2,r,h);leaf(u,v,3,-.27,.22,2,green);}break;
   case 'season-ghost':{
    cy(.5,.5,.37,0,1.3,shade(c,-30));
    shape(.5,.46,7,.32,.26,28,[[1,0],[.86,.3],[.88,.65],[.65,.88],[0,1]],cream);
    for(const [u,v]of [[.26,.42],[.42,.64],[.65,.62],[.75,.4]])puff(u,v,6,.1,.08,7,cream);
    for(const u of [.39,.59]){puff(u,.706,23,.045,.018,4,ink);panel(u-.012,.728,.017,25,1.1,'#ffffff');}
    line3([[.45,.724,20],[.5,.73,19.3],[.55,.724,20]],ink,.015);
    puff(.21,.45,17,.19,.08,6,cream);puff(.78,.45,17,.18,.08,6,cream);
    cy(.85,.55,.09,11,5,gold);cy(.85,.55,.065,12,3,'#fff0ac');line3([[.78,.55,16],[.78,.55,20],[.92,.55,20],[.92,.55,16]],gold,.012);break;
   }
   case 'season-memorial':b(.08,.08,.84,.84,2,0,'#6b8067');b(.21,.2,.58,.19,24,2,c);puff(.5,.3,22,.29,.095,9,c);panel(.29,.401,.42,11,13,shade(c,18));trim(.28,.41,.44,10,14,shade(c,-25));line([.37,.42,18],[.63,.42,18],gold,.018);line([.5,.42,14],[.5,.42,22],gold,.018);puff(.52,.65,2,.14,.12,7,cream);for(const u of [.46,.56])panel(u,.768,.04,5,2,ink);for(const j of [0,1])line([.22,.6+j*.12,3],[.8,.78-j*.12,3],cream,.025);leaf(.12,.3,2,.12,.16,5,green);break;
   case 'season-cauldron':cauldron(true);break;
   case 'theme-cauldron':cauldron(false);break;
   case 'season-flame':cy(.5,.5,.35,0,3,ink);cy(.5,.5,.25,3,3,c);for(let j=0;j<3;j++){const u=.34+j*.15;d([[u-.12,.5,6],[u-.14,.5,15],[u+.03,.5,31-j*3],[u+.14,.5,19],[u+.1,.5,6]],j===1?'#ddbdff':c);d([[u-.045,.51,7],[u+.02,.51,22-j*2],[u+.08,.51,7]],'#f2dfff');}break;
   case 'season-mirror':b(.12,.12,.76,.7,3,0,ink);b(.18,.25,.64,.16,32,3,c);puff(.5,.33,32,.32,.08,10,c);panel(.26,.42,.48,10,24,'#527992');trim(.25,.431,.5,9,26,gold);line([.3,.44,12],[.63,.44,31],'#a9d7de',.025);puff(.5,.455,19,.12,.02,9,cream);for(const u of [.45,.53])panel(u,.48,.025,24,1.5,ink);for(const u of [.17,.77])b(u,.22,.06,.3,3,4,gold);break;
   case 'season-tub':{
    feet(1,2,6);b(.1,.12,.8,1.76,8,5,c);b(.18,.22,.64,1.56,1,13,'#70a6b4');for(const u of [.08,.82])b(u,.12,.1,1.76,3,13,shade(c,25));for(const v of [.12,1.78])b(.08,v,.84,.1,3,13,shade(c,25));
    for(const u of [.07,.93]){const k=u<.5?1:-1;d([[u,.55,14],[u,.7,24],[u+k*.15,.96,19],[u,1.15,22],[u+k*.12,1.38,16],[u,1.5,14]],ink);line3([[u,.7,24],[u,1.1,16],[u,1.5,14]],gold,.012);}
    for(const [u,v]of [[.3,.4],[.65,.65],[.4,1.2],[.67,1.5]])puff(u,v,14,.1,.1,2.5,cream);line3([[.72,.24,16],[.72,.24,25],[.5,.24,25],[.5,.24,23]],gold,.035);break;
   }
   case 'season-web':b(.02,.02,.96,.96,.6,0,shade(c,-30));for(let j=0;j<8;j++){const a=j*Math.PI/4;line([.5,.5,1],[.5+Math.cos(a)*.46,.5+Math.sin(a)*.46,1],cream,.009);}for(const r of [.14,.27,.43])ring(.5,.5,r,1,cream);puff(.66,.6,1,.045,.06,2,ink);for(let j=0;j<3;j++)for(const k of [-1,1])line([.66,.58+j*.02,2],[.66+k*.1,.54+j*.05,1],ink,.009);break;
   case 'theme-banana':b(.16,.16,.68,.68,7,0,c);b(.2,.2,.6,.6,1,7,'#514c3e');line([.5,.5,7],[.48,.48,36],'#a6a16b',.055);for(let j=0;j<8;j++){const a=j*Math.PI/4;leaf(.48,.48,33,Math.cos(a)*.65,Math.sin(a)*.65,5+j%3*3,shade(green,j%3*10));}for(let j=0;j<5;j++)line3([[.52+j*.05,.65,26],[.56+j*.05,.72,22],[.63+j*.05,.72,21]],'#f4cc68',.025);grain(.2,.845,.6,1,5);break;
   case 'theme-mask':b(.38,.35,.24,.2,18,0,wood);cy(.5,.5,.32,0,3,wood);shape(.5,.48,14,.35,.14,29,[[.2,0],[.8,.2],[1,.7],[.7,.92],[.2,1]],c);for(const u of [.28,.58]){panel(u,.627,.16,30,5,cream);panel(u+.05,.64,.055,31,2,ink);}b(.46,.62,.08,.12,9,23,wood);line3([[.32,.64,21],[.5,.66,19],[.68,.64,21]],cream,.025);for(let j=0;j<3;j++)for(const k of [-1,1])line([.5+k*.26,.63,24+j*3],[.5+k*.32,.63,25+j*3],gold,.018);break;
   case 'theme-fan':b(.15,.25,1.7,.5,3,0,wood);for(let j=0;j<13;j++){const a=Math.PI*j/12,u=1+Math.cos(a)*.9,z=8+Math.sin(a)*36;d([[1,.47,6],[u,.47,z],[1+Math.cos(a+.12)*.9,.47,8+Math.sin(a+.12)*36]],shade(c,j%3*7));line([1,.49,6],[u,.49,z],wood,.015);}for(const r of [.45,.7,.9]){const p=[];for(let j=0;j<=12;j++){const a=Math.PI*j/12;p.push([1+Math.cos(a)*r,.5,8+Math.sin(a)*36*r/.9]);}line3(p,gold,.012);}break;
   case 'theme-seat':feet();b(.12,.12,.76,.15,30,6,wood);b(.12,.25,.76,.66,4,11,wood);cushion(.17,.28,.66,.59,15);for(const u of [.04,.84])b(u,.15,.12,.75,5,22,wood);for(let j=0;j<5;j++)leaf(.18+j*.15,.15,34,(j-2)*.09,.05,8,green);grain(.16,.276,.68,21,12);break;
   case 'theme-idol':b(.08,.08,.84,.84,4,0,'#71877b');shape(.5,.5,4,.3,.25,20,[[.95,0],[.8,.5],[1,1]],c);shape(.5,.5,24,.37,.29,16,[[.85,0],[1,.7],[.65,1]],'#91a99b');for(const u of [.24,.58]){b(u,.77,.18,.025,2,34,ink);b(u,.78,.18,.025,1,37,gold);}b(.45,.78,.1,.1,6,27,c);line([.32,.79,27],[.68,.79,27],ink,.015);for(let j=0;j<5;j++)leaf(.2+j*.13,.45,39,.08,.1,3,green);leaf(.28,.4,11,-.25,.1,4,green);break;
   case 'theme-terrarium':b(.06,.06,.88,.88,4,0,c);b(.1,.1,.8,.8,2,4,'#637d59');for(const [u,v]of [[.32,.35],[.65,.6]])for(let j=0;j<5;j++)leaf(u,v,8+j*3,Math.cos(j*1.7)*.24,Math.sin(j*1.7)*.24,5,green);for(const u of [.08,.88])for(const v of [.08,.88])b(u,v,.04,.04,32,4,gold);for(const v of [.1,.9]){d([[.1,v,36],[.5,v,46],[.9,v,36]],'#b7e7d72b');line3([[.1,v,36],[.5,v,46],[.9,v,36]],gold,.025);d([[.1,v,6],[.9,v,6],[.9,v,36],[.1,v,36]],'#b7e7d718');}line([.5,.1,46],[.5,.9,46],gold,.025);line([.18,.91,28],[.38,.91,19],'#d5f9eb',.015);break;
   case 'theme-arch':for(const u of [.08,1.72]){b(u,.15,.2,.7,42,0,wood);grain(u,.855,.2,1,39);}b(.05,.2,1.9,.4,5,42,c);for(let j=0;j<11;j++)leaf(.12+j*.17,.6,46,.18,.05,j%2?-5:3,green);for(const u of [.2,1.8])for(let j=0;j<5;j++){line([u,.86,7+j*7],[u-.06,.86,14+j*7],green,.025);leaf(u,.86,9+j*7,j%2?.18:-.18,0,4,green);}break;
   case 'theme-nest':b(.1,.1,.8,.8,3,0,wood);line3([[.5,.12,3],[.5,.12,49],[.5,.55,51],[.5,.6,42]],gold,.05);for(let j=0;j<9;j++){const a=Math.PI+j*Math.PI/8;const u=.5+Math.cos(a)*.38,v=.5+Math.sin(a)*.34;line3([[.5+(u-.5)*.6,.5+(v-.5)*.6,12],[u,v,19],[u,v,29],[.5+(u-.5)*.55,.5+(v-.5)*.55,38],[.5,.5,42]],wood,.028);}for(const [z,r]of [[15,.8],[20,1],[26,1],[32,.85],[37,.55]]){const p=[];for(let j=0;j<=12;j++){const a=Math.PI+j*Math.PI/12;p.push([.5+Math.cos(a)*.38*r,.5+Math.sin(a)*.34*r,z]);}line3(p,gold,.014);}cushion(.18,.25,.64,.62,13);cushion(.3,.24,.4,.24,19,cream);break;
   case 'theme-fruit':feet(2,1,14);b(.04,.04,1.92,.92,3,14,c);for(const u of [.1,1.65]){cy(u,.82,.16,0,4,ink);cy(u,.82,.07,4,.6,gold);}for(let j=0;j<3;j++){const u=.1+j*.6;b(u,.1,.55,.8,2,17,wood);for(const v of [.1,.84])b(u,v,.55,.04,5,17,gold);for(const [dx,v]of [[.14,.3],[.38,.3],[.25,.63]]){puff(u+dx,v,19,.115,.115,6,j===0?'#e6b957':j===1?'#d98965':'#98b57a');leaf(u+dx,v,25,.07,.03,1,green);}}grain(.08,.965,1.8,14,3);break;
   case 'theme-bridge':for(let j=0;j<8;j++){const z=4+Math.abs(j-3.5);b(j*.25,.08,.23,.84,2.5,z,c);grain(j*.25,.925,.23,z,2);}for(const u of [.04,1.88])for(const v of [.08,.9]){b(u,v,.08,.08,29,0,wood);for(const z of [23,25])line([u-.02,v-.02,z],[u+.1,v+.1,z],gold,.025);}for(const v of [.1,.94]){const p=[];for(let j=0;j<=10;j++)p.push([.08+j*.184,v,25-5*Math.sin(j*Math.PI/10)]);line3(p,gold,.025);for(let j=1;j<7;j++)line([j*.27,v,21],[j*.27,v,9],gold,.012);}break;
   case 'theme-roses':for(let j=0;j<7;j++)b(.08+j*.29,.3,.035,.08,39,0,metal);for(const z of [9,23,37])b(.05,.3,1.9,.06,1.5,z,metal);for(let j=0;j<8;j++){const u=.15+j*.23,z=12+j%3*9;line([u-.06,.39,5],[u+.03,.39,z+4],green,.018);leaf(u,.4,z-3,.14,.01,3,green);flower(u,.43,z,c);}break;
   case 'theme-batseat':feet();b(.12,.1,.76,.16,27,7,c);d([[.08,.27,22],[0,.27,42],[.25,.27,35],[.5,.27,47],[.75,.27,35],[1,.27,42],[.92,.27,22]],c);trim(.21,.28,.58,22,13,gold);b(.08,.28,.84,.64,5,10,ink);cushion(.14,.3,.72,.58,15);for(const u of [.04,.86])b(u,.25,.1,.65,5,23,ink);break;
   case 'theme-potions':b(.08,.1,.84,.12,43,3,ink);for(const u of [.08,.84])b(u,.1,.08,.78,43,3,c);for(const z of [3,16,29,43])b(.06,.08,.88,.84,2,z,wood);for(const z of [5,18,31])for(let j=0;j<3;j++)bottle(.27+j*.23,.7,z,['#91d4b7','#bc9add','#e4b870'][j]);b(.04,.06,.92,.88,2,45,gold);break;
   case 'theme-gargoyle':b(.08,.08,.84,.84,4,0,metal);b(.18,.18,.64,.64,4,4,c);puff(.5,.5,8,.25,.23,18,c);puff(.5,.56,25,.28,.23,13,'#a1a0b5');for(const u of [.29,.62]){b(u,.68,.1,.2,3,8,shade(c,20));d([[u,.58,35],[u+.03,.56,44],[u+.13,.6,35]],c);panel(u,.793,.09,32,2,'#f4d38f');}b(.43,.78,.14,.11,3,27,metal);for(const k of [-1,1]){d([[.5+k*.15,.35,16],[.5+k*.6,.3,38],[.5+k*.52,.35,24],[.5+k*.4,.35,26],[.5+k*.3,.35,19]],c);line([.5+k*.15,.36,16],[.5+k*.6,.31,38],gold,.012);}break;
   case 'theme-gate':for(let j=0;j<9;j++){const u=.08+j*.22;b(u,.35,.04,.12,36,0,c);d([[u-.04,.41,36],[u+.02,.41,43],[u+.08,.41,36]],gold);}for(const z of [8,26])b(.04,.34,1.92,.1,2,z,metal);for(let j=0;j<4;j++)line3([[.2+j*.44,.46,29],[.3+j*.44,.46,33],[.4+j*.44,.46,29]],gold,.018);break;
   case 'theme-coffin':{
    const outline=[[.2,0],[.05,35],[.25,48],[.75,48],[.95,35],[.8,0]];
    d(outline.map(([u,z])=>[u,.15,z]),ink);for(let j=0;j<outline.length;j++){const [u,z]=outline[j],[v,h]=outline[(j+1)%outline.length];d([[u,.15,z],[v,.15,h],[v,.82,h],[u,.82,z]],c);line([u,.83,z],[v,.83,h],gold,.018);}for(const z of [3,17,31])b(.22,.18,.56,.62,2,z,wood);for(const z of [5,19,33])for(let j=0;j<3;j++){b(.28+j*.15,.48,.1,.24,9-j%2*2,z,[cream,'#9b8bbd','#8ab7ab'][j]);panel(.3+j*.15,.725,.05,z+2,.7,gold);}break;
   }
   case 'theme-stained':for(let j=0;j<3;j++){const u=.04+j*.65;for(const x of [u,u+.56])b(x,.28,.055,.32,40,0,metal);const v=.45;d([[u+.06,v,3],[u+.56,v,3],[u+.56,v,35],[u+.31,v,47],[u+.06,v,35]],c);for(const z of [6,17,28]){d([[u+.08,v+.01,z+5],[u+.31,v+.01,z+10],[u+.54,v+.01,z+5],[u+.31,v+.01,z]],j%2?'#9dc9ca':'#c3a6d8');line3([[u+.08,v+.02,z+5],[u+.31,v+.02,z+10],[u+.54,v+.02,z+5],[u+.31,v+.02,z],[u+.08,v+.02,z+5]],gold,.012);}line3([[u+.04,v,35],[u+.31,v,48],[u+.58,v,35]],gold,.025);}break;
   case 'theme-organ':b(.02,.06,1.96,.86,18,0,c);for(const u of [.08,1.82])b(u,.1,.1,.8,24,0,wood);for(let j=0;j<9;j++){const u=.17+j*.205,h=23+12*Math.sin(j*Math.PI/8);cy(u,.3,.055,18,h,'#aebccc',8);panel(u-.03,.36,.06,23,5,ink);cy(u,.3,.067,18+h,1,gold,8);}b(.12,.65,1.76,.32,2,20,wood);for(let j=0;j<18;j++){b(.14+j*.095,.68,.085,.26,.7,22,cream);if(j%7!==2&&j%7!==6)b(.2+j*.095,.68,.035,.13,1.2,22.7,ink);}for(const u of [.22,.78,1.34]){panel(u,.931,.42,3,12,shade(c,-20));trim(u,.94,.42,3,12,gold);}break;
   case 'wardrobe':feet(2,1,4);b(.05,.05,1.9,.86,40,4,c);b(.02,.02,1.96,.94,3,44,cream);for(const u of [.13,1.04]){panel(u,.921,.82,7,34,shade(c,12));trim(u,.935,.82,7,34,gold);panel(u+.12,.94,.58,12,24,shade(c,-10));trim(u+.12,.95,.58,12,24,shade(c,30));}for(const u of [.88,1.1])b(u,.96,.035,.035,5,22,gold);break;
   case 'vanity':feet(1,1,19);b(.04,.04,.92,.9,5,19,c);panel(.13,.95,.74,20,3,shade(c,20));b(.46,.97,.1,.02,.8,21,gold);b(.12,.12,.76,.12,24,24,gold);panel(.2,.25,.6,28,17,'#83b3c2');trim(.18,.265,.64,27,19,cream);line([.25,.27,30],[.65,.27,43],'#d5eff0',.02);bottle(.22,.67,24,'#c1a4db');cy(.73,.7,.1,24,2,gold);break;
   case 'canopy-bed':feet(1,2,7);b(.03,.03,.94,1.94,5,7,wood);g.mattress(12);for(const u of [.03,.91])for(const v of [.03,1.91]){cy(u,v,.035,3,46,gold,8);puff(u,v,49,.055,.055,2,cream);}for(const u of [.03,.91])line([u,.03,48],[u,1.91,48],gold,.035);for(const v of [.03,1.91])line([.03,v,48],[.91,v,48],gold,.035);for(const u of [.04,.9])for(let j=0;j<3;j++)d([[u,.08+j*.06,47],[u,.13+j*.06,47],[u,.32+j*.06,24],[u,.22+j*.06,24]],shade(c,25+j*9));d([[.04,.04,49],[.91,.04,49],[.91,1.92,49],[.04,1.92,49]],'#d9c7ed38');break;
   case 'easel':for(const u of [.16,.81])line([u,.15,0],[.5,.25,46],wood,.035);line([.5,.84,0],[.5,.25,39],wood,.035);b(.07,.3,.86,.1,27,16,cream);panel(.15,.411,.7,20,19,'#8fbac5');d([[.15,.42,20],[.39,.42,33],[.6,.42,25],[.85,.42,31],[.85,.42,20]],'#729888');cy(.68,.4,.06,35,1,gold,8);b(.05,.3,.9,.24,2,15,c);for(const u of [.2,.45,.7])cy(u,.5,.04,17,.8,['#bf80aa','#e5bf79','#87b8ad'][Math.round((u-.2)*4)],8);break;
   case 'sewing-desk':feet(2,1,20);b(.03,.03,1.94,.94,3,20,wood);b(.16,.2,.6,.7,1,23,c);g.fabric(.16,.2,.6,.7,24,c);b(1,.22,.7,.5,3,23,cream);b(1.5,.23,.18,.45,12,26,c);b(1.08,.23,.6,.4,5,35,c);line([1.12,.45,35],[1.12,.45,27],gold,.012);cy(1.56,.4,.06,40,4,gold,8);break;
   case 'tool-stand':b(.04,.1,.92,.8,10,0,wood);b(.08,.15,.84,.1,34,10,c);for(let j=0;j<5;j++)for(let k=0;k<4;k++)panel(.16+j*.15,.26,.025,15+k*7,.6,shade(c,-30));for(const [u,z]of [[.25,34],[.5,29],[.74,36]]){line([u,.28,z-9],[u,.28,z],wood,.03);line([u-.08,.29,z],[u+.08,.29,z],metal,.03);}trim(.14,.91,.72,2,6,gold);break;
   case 'crescent-light':cy(.5,.5,.32,0,3,c);cy(.5,.5,.23,3,1,gold);line([.5,.5,4],[.5,.5,36],metal,.025);for(let j=0;j<16;j++){const a=-Math.PI/2+j*Math.PI/16,q=a+Math.PI/16;d([[.5+Math.cos(a)*.38,.5,37+Math.sin(a)*12],[.5+Math.cos(q)*.38,.5,37+Math.sin(q)*12],[.48+Math.cos(q)*.23,.5,37+Math.sin(q)*10],[.48+Math.cos(a)*.23,.5,37+Math.sin(a)*10]],'#ffe1a4');}break;
   case 'listening-console':feet(2,1,6);b(.04,.04,1.92,.92,19,6,c);b(0,0,2,1,2,25,cream);for(const u of [.12,1.13]){panel(u,.97,.75,8,14,ink);for(let j=0;j<7;j++)line([u+.06+j*.1,.98,9],[u+.06+j*.1,.98,21],wood,.012);}cy(.58,.48,.32,27,1,ink);for(const r of [.13,.2,.27])ring(.58,.48,r,28,'#607081');cy(.58,.48,.07,28,.2,gold);line3([[.95,.3,28],[.9,.68,28],[.75,.68,28]],gold,.018);b(1.24,.28,.5,.4,1,27,ink);for(let j=0;j<4;j++)b(1.3+j*.1,.35,.05,.22,.3,28,'#98cfb9');break;
   case 'channel-sofa':feet(2,1,5);b(.04,.06,1.92,.88,7,5,ink);for(let j=0;j<5;j++){const u=.15+j*.34;b(u,.08,.3,.2,23,10,c);cushion(u,.32,.3,.57,12);}for(const u of [.02,1.78])b(u,.12,.2,.82,13,9,c);cushion(.28,.3,.37,.37,18,cream);line([.1,.95,8],[1.9,.95,8],gold,.015);break;
  }
  return true;
 }
 // Effects use the same tile-space rotation as the cached model and are painted
 // within its depth node, so foreground furniture still occludes them correctly.
 function effects(ctx,item,x,y,time=0){
  const s=item.sprite||item.sprite_id;if(!animated.has(s))return;
  const w=item.width||1,l=item.length||1,r=(item.rotation||0)%8;
  const point=(u,v,z)=>{const p=r===2?[l-v,u]:r===4?[w-u,l-v]:r===6?[v,w-u]:[u,v];return [x+(p[0]-p[1])*18,y+(p[0]+p[1])*9-z];};
  const t=time/1000,pulse=.65+Math.sin(t*1.6)*.2;
  const dot=(u,v,z,r,tint,alpha=1)=>{const p=point(u,v,z);ctx.globalAlpha=alpha;ctx.fillStyle=tint;ctx.beginPath();ctx.ellipse(p[0],p[1],r,r*.8,0,0,Math.PI*2);ctx.fill();};
  ctx.save();
  if(s==='season-cauldron'||s==='theme-cauldron'||s==='season-tub'){
   for(let j=0;j<3;j++){const p=(t*.32+j*.33)%1;dot(.32+j*.17,s==='season-tub'?.5+j*.4:.5, (s==='season-tub'?15:25)+p*9,1.2-p*.65,'#c6ffe4',(1-p)*.7);}
  }else if(s==='season-flame'){
   for(let j=0;j<3;j++){const p=(t*.4+j*.33)%1;dot(.5+Math.sin(t*2+j)*.1,.5,12+p*20,2.3-p*1.7,j%2?'#f3ddff':'#b78bf3',(1-p)*.7);}
  }else if(s==='season-lantern'){dot(.5,.87,17,2.1,'#ffdc8a',pulse*.35);}
  else if(s==='season-ghost'){dot(.85,.55,14,2.2,'#ffdf92',pulse*.6);for(let j=0;j<2;j++)dot(.3+j*.4,.6,5+Math.sin(t+j)*1.3,1.4,'#d5f5ed',pulse*.35);}
  else if(s==='theme-terrarium'){for(let j=0;j<2;j++)dot(.35+j*.3+Math.sin(t*.7+j)*.05,.5,17+j*9+Math.sin(t+j)*2,1,'#fff1b5',pulse*.65);}
  else if(s==='theme-potions'){for(let j=0;j<3;j++)dot(.27+j*.23,.76,8+j*13+Math.sin(t+j),.8,'#e2fff0',pulse*.55);}
  else if(s==='season-mirror'){dot(.5,.46,26+Math.sin(t)*2,1.1,'#d2efff',pulse*.55);}
  else if(s==='crescent-light'){dot(.75,.5,38,4,'#ffe7b7',pulse*.15);}
  else if(s==='listening-console'){dot(.58+Math.cos(t*.8)*.22,.48+Math.sin(t*.8)*.22,28.4,.6,'#e6d8b6',.8);}
  ctx.restore();
 }
 window.EarnlyDecorPolish={has:s=>models.has(s),build,effects,isAnimated:s=>animated.has(s)};
})();
