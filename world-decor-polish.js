/* Original Earnly sculpted furniture. Static geometry is cached by the renderer;
   only a few small, local light/water details move. No simulation or network writes. */
(()=>{
 const models=new Set(['column','divider','theme-mask','theme-fan','theme-banana','theme-seat','theme-idol','theme-terrarium','theme-arch','theme-nest','theme-fruit','theme-bridge','theme-roses','theme-cauldron','theme-batseat','theme-potions','theme-gargoyle','theme-gate','theme-coffin','theme-stained','theme-organ','vanity','wardrobe','canopy-bed','easel','sewing-desk','tool-stand','crescent-light','listening-console','channel-sofa','season-lantern','season-patch','season-ghost','season-memorial','season-cauldron','season-flame','season-mirror','season-tub','season-web']);
 ['table', 'walnut-nesting', 'bookshelf', 'sage-slatted', 'woven-seat', 'flowers', 'theme-orchid', 'theme-fern', 'theme-trunk', 'theme-fire', 'theme-waterfall', 'lily-basin', 'vine-screen', 'plant-house', 'bed', 'cabin-bed', 'velvet-bed', 'platform-bed', 'theme-daybed', 'poster-bed', 'round-bed', 'bunk-bed', 'capsule-bed', 'racer-bed', 'show-meteor', 'show-orrery', 'show-aquarium', 'show-gallery', 'trophy'].forEach(s=>models.add(s));
 const animated=new Set(['theme-terrarium','theme-cauldron','theme-potions','crescent-light','listening-console','season-lantern','season-ghost','season-cauldron','season-flame','season-mirror','season-tub']);
 ['theme-fire','theme-waterfall','lily-basin','plant-house','capsule-bed','show-meteor','show-orrery','show-aquarium','trophy'].forEach(s=>animated.add(s));
 ["bath-toilet", "bath-sink", "bath-shower", "bath-tub", "bath-mirror", "bath-towels", "bath-cabinet", "bath-hamper", "bath-mat", "play-rose-vase", "play-sunflower-vase", "play-yucca-planter", "play-cactus-planter", "bentwood-chair", "bistro-table", "coffee-station", "pastry-counter"].forEach(s=>models.add(s));
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
  const oval=(u,v,z,rx,ry,t)=>d(Array.from({length:24},(_,j)=>{const a=j*Math.PI/12;return [u+Math.cos(a)*rx,v+Math.sin(a)*ry,z];}),t);
  const ovalRim=(u,v,z,rx,ry,t,w=.018)=>line3(Array.from({length:25},(_,j)=>{const a=j*Math.PI/12;return [u+Math.cos(a)*rx,v+Math.sin(a)*ry,z];}),t,w);
  const tap=(u,v,z)=>{line3([[u,v,z],[u,v,z+8],[u,v+.14,z+10],[u,v+.28,z+10],[u,v+.28,z+8]],metal,.035);cy(u,v,.08,z,.7,gold);};
  switch(s){
   case 'bath-hamper':{
    shape(.5,.5,1,.35,.32,22,[[.8,0],[1,.94],[.94,1]],wood);for(let j=0;j<10;j++)ovalRim(.5,.5,3+j*2,.29+j*.006,.27+j*.005,j%2?cream:'#bd976e',.012);
    for(let j=0;j<12;j++){const a=j*Math.PI/6;line([.5+Math.cos(a)*.29,.5+Math.sin(a)*.27,3],[.5+Math.cos(a)*.35,.5+Math.sin(a)*.32,22],shade(wood,20),.011);}
    shape(.5,.5,23,.37,.34,3,[[.94,0],[1,.5],[.92,1]],c);ovalRim(.5,.5,26,.29,.26,cream);line3([[.42,.5,26],[.43,.5,28],[.57,.5,28],[.58,.5,26]],wood,.025);break;
   }
   case 'bath-towels':{
    for(const u of [.16,.82]){b(u-.08,.1,.16,.8,2,0,ink);line([u,.5,2],[u,.5,37],metal,.03);cy(u,.5,.055,37,1.5,gold);}line([.16,.5,36],[.82,.5,36],metal,.03);line([.16,.7,23],[.82,.7,23],metal,.025);
    b(.27,.45,.42,.08,19,17,c);b(.34,.66,.29,.08,11,12,cream);for(const z of [19,20,22])line([.29,.54,z],[.67,.54,z],shade(c,32),.012);for(let j=0;j<5;j++)line([.31+j*.075,.54,18],[.31+j*.075,.54,34],shade(c,j%2?12:-12),.009);break;
   }
   case 'bath-mirror':{
    shape(.5,.5,0,.34,.3,3,[[.9,0],[1,.4],[.86,1]],wood);for(const u of [.22,.74])line([u,.5,3],[u,.5,43],gold,.025);
    b(.22,.44,.56,.09,31,12,c);panel(.265,.539,.47,15,25,'#90b6c6');trim(.25,.55,.5,14,27,gold);d([[.29,.557,17],[.43,.557,17],[.71,.557,38],[.57,.557,38]],'#e0f2ed80');line([.31,.56,22],[.54,.56,38],cream,.012);for(const u of [.19,.79])cy(u,.5,.05,26,2,metal);break;
   }
   case 'bath-toilet':{
    shape(.5,.58,0,.24,.28,11,[[.8,0],[1,.2],[.65,.8],[.8,1]],cream);shape(.5,.58,10,.36,.38,8,[[.6,0],[1,.7],[.96,1]],'#e5e8df');oval(.5,.6,18.1,.26,.29,'#779ca9');oval(.5,.61,18.2,.17,.2,'#c2e8e4');ovalRim(.5,.58,19,.32,.35,cream,.055);
    b(.16,.06,.68,.24,25,3,'#e9eee7');b(.12,.03,.76,.3,2,28,c);cy(.5,.17,.045,30,.7,metal);panel(.23,.305,.08,24,1.2,gold);break;
   }
   case 'bath-sink':{
    feet(1,1,5);b(.1,.13,.8,.73,21,5,c);b(.05,.08,.9,.83,3,26,cream);for(const u of [.15,.53]){trim(u,.875,.32,8,15,shade(c,-23));panel(u+.13,.89,.07,20,1.2,gold);}shape(.5,.48,29,.34,.27,3,[[.92,0],[1,1]],'#e1e5dd');oval(.5,.48,32.1,.27,.21,'#abc2c1');oval(.5,.48,32.2,.045,.035,metal);ovalRim(.5,.48,32.3,.32,.25,cream,.025);tap(.5,.15,29);b(.78,.27,.09,.13,4,29,c);cy(.825,.33,.025,33,1.2,gold);break;
   }
   case 'bath-cabinet':{
    feet(1,1,4);b(.12,.18,.76,.64,39,4,c);b(.08,.14,.84,.72,3,43,cream);for(const z of [7,25]){panel(.18,.825,.64,z,15,shade(c,8));trim(.18,.84,.64,z,15,shade(c,-25));line([.61,.86,z+7],[.73,.86,z+7],gold,.025);}b(.17,.16,.66,.65,2,4,wood);for(let j=0;j<3;j++)b(.24,.36+j*.09,.3,.08,2,46,shade(c,25+j*7));b(.64,.4,.1,.13,4,46,gold);break;
   }
   case 'bath-shower':{
    b(.05,.05,.9,.9,3,0,c);b(.11,.11,.78,.78,1,3,cream);cy(.5,.5,.06,4.1,.2,metal);
    for(const v of [.08,.9]){d([[.08,v,4],[.92,v,4],[.92,v,48],[.08,v,48]],'#9bcfd226');line([.08,v,48],[.92,v,48],metal,.018);}for(const u of [.08,.92])for(const v of [.08,.9])line([u,v,4],[u,v,48],metal,.021);
    d([[.92,.08,4],[.92,.9,4],[.92,.9,48],[.92,.08,48]],'#c3e7df20');line3([[.35,.12,6],[.35,.12,40],[.5,.12,44],[.5,.34,44]],metal,.025);cy(.5,.34,.15,43,1.5,metal);cy(.5,.34,.13,42.5,.3,cream);line([.89,.68,19],[.89,.68,29],gold,.03);line([.16,.91,23],[.36,.91,42],'#e4f7ee',.012);b(.1,.18,.17,.2,1,18,metal);b(.13,.23,.07,.1,5,19,c);break;
   }
   case 'bath-tub':{
    for(const u of [.22,.78])for(const v of [.3,1.7])puff(u,v,0,.08,.09,5,metal);
    shape(.5,1,4,.46,.91,15,[[.65,0],[.9,.3],[1,.85],[1,1]],c);oval(.5,1,19.1,.4,.83,cream);oval(.5,1,19.2,.34,.73,'#b2deda');ovalRim(.5,1,19.4,.42,.85,cream,.035);ovalRim(.5,1.1,19.5,.23,.4,'#def5ea',.009);tap(.5,.17,19);b(.13,1.43,.74,.15,1.2,20,wood);b(.2,1.46,.28,.1,2,21.2,cream);cy(.73,1.5,.05,21.2,3,gold);break;
   }
   case 'bath-mat':b(.05,.08,.9,1.84,.8,0,shade(c,-20));b(.09,.12,.82,1.76,.6,.8,c);for(let j=0;j<13;j++)line([.15,.2+j*.12,1.5],[.85,.2+j*.12,1.5],shade(c,j%2?20:8),.018);for(const v of [.08,1.92])for(let j=0;j<8;j++)line([.16+j*.1,v,1],[.16+j*.1,v+(v<1?-.06:.06),.7],cream,.009);break;
   case 'play-rose-vase':case 'play-sunflower-vase':{
    const rose=s==='play-rose-vase';shape(.5,.5,0,.25,.24,14,[[.65,0],[1,.3],[.88,.65],[.45,1]],shade(c,-18));ovalRim(.5,.5,14,.12,.115,gold);for(let j=0;j<3;j++){const u=.32+j*.17,z=27+(j%2)*7;line3([[.5,.5,14],[u,.5,z]],green,.016);leaf(u,.5,20,j%2?.23:-.2,.1,4,green);if(rose){flower(u,.5,z,c);flower(u,.5,z+1,shade(c,22));puff(u,.5,z+3,.055,.055,3,shade(c,-16));}else{for(let k=0;k<10;k++){const a=k*Math.PI/5;leaf(u,.5,z,Math.cos(a)*.17,Math.sin(a)*.17,3,c);}puff(u,.5,z+1,.08,.08,3,'#846147');}}
    line([.33,.67,3],[.35,.67,9],shade(c,55),.012);break;
   }
   case 'play-yucca-planter':case 'play-cactus-planter':{
    shape(.5,.5,0,.36,.33,9,[[.78,0],[1,.85],[1,1]],c);oval(.5,.5,9.2,.3,.27,'#725b45');ovalRim(.5,.5,9.4,.35,.32,gold);for(let j=0;j<3;j++){const u=.28+j*.22,h=14+j%2*13;if(s==='play-yucca-planter'){cy(u,.5,.045,9,h,wood);for(let k=0;k<7;k++){const a=k*Math.PI/3.5;leaf(u,.5,9+h,Math.cos(a)*.28,Math.sin(a)*.28,7+k%2*3,shade(green,k%3*12));}}else{shape(u,.5,9,.105,.1,h,[[.8,0],[1,.7],[.8,.92],[0,1]],green);for(let z=12;z<9+h-2;z+=4)line([u-.06,.59,z],[u+.06,.59,z+1],cream,.009);if(j===1)flower(u,.5,9+h,'#e3a5b5');}}break;
   }
   case 'bentwood-chair':{
    feet(1,1,14);shape(.5,.54,14,.4,.35,3,[[.92,0],[1,.6],[.94,1]],wood);cushion(.18,.27,.64,.55,17,c);
    line3([[.13,.18,0],[.13,.18,28],[.22,.18,37],[.5,.18,41],[.78,.18,37],[.87,.18,28],[.87,.18,0]],wood,.035);line3([[.3,.18,18],[.3,.18,31],[.5,.18,35],[.7,.18,31],[.7,.18,18]],c,.025);for(const u of [.13,.87])line3([[u,.18,27],[u,.74,27],[u,.77,15]],wood,.025);break;
   }
   case 'bistro-table':{
    cy(.5,.5,.31,0,3,ink);cy(.5,.5,.08,3,20,metal);shape(.5,.5,23,.48,.48,3,[[.93,0],[1,.3],[1,.8],[.94,1]],wood);ovalRim(.5,.5,26.2,.42,.42,gold);cy(.35,.53,.12,26.3,.5,cream);shape(.35,.53,26.8,.075,.075,4,[[.7,0],[1,1]],cream);oval(.35,.53,30.9,.058,.058,'#6b4e3b');line3([[.42,.53,30],[.48,.53,29],[.48,.53,28],[.42,.53,27]],cream,.015);bottle(.7,.35,26.3,c);flower(.7,.35,36,'#e7b49a');break;
   }
   case 'coffee-station':{
    b(.06,.08,.88,.84,21,0,wood);for(const u of [.12,.54]){panel(u,.925,.34,3,16,c);trim(u,.94,.34,3,16,gold);}b(.02,.03,.96,.94,3,21,cream);b(.18,.16,.64,.45,17,24,c);b(.14,.14,.72,.51,2,41,metal);b(.23,.61,.54,.1,9,29,ink);b(.19,.47,.62,.35,1,25,metal);for(const u of [.32,.65]){line([u,.64,35],[u,.64,32],metal,.026);cy(u,.7,.07,26,4,cream);cy(u,.7,.05,30,.3,'#654735');}for(const u of [.29,.5,.71])panel(u,.62,.04,38,1.2,gold);cy(.5,.38,.1,43,3,cream);break;
   }
   case 'pastry-counter':{
    b(.06,.1,1.88,.8,17,0,wood);b(.03,.06,1.94,.88,2,17,cream);for(let j=0;j<9;j++)panel(.14+j*.2,.915,.08,3,11,shade(c,j%2?12:-10));for(const z of [20,29]){b(.13,.16,1.74,.65,1,z,gold);for(let j=0;j<4;j++){const u=.33+j*.43;cy(u,.5,.15,z+1,.4,cream);puff(u,.5,z+1.5,.12,.13,4,j%2?'#b97855':'#ddb078');line([u-.06,.53,z+3],[u+.05,.53,z+4],cream,.012);}}
    for(const u of [.08,1.92])for(const v of [.12,.88])line([u,v,19],[u,v,39],metal,.018);for(const v of [.12,.88]){d([[.08,v,19],[1.92,v,19],[1.92,v,39],[.08,v,39]],'#bde6df20');line([.08,v,39],[1.92,v,39],metal,.018);}d([[.08,.12,39],[1.92,.12,39],[1.92,.88,39],[.08,.88,39]],'#daeee52b');line([.18,.9,24],[.37,.9,36],cream,.012);break;
   }

   case 'table':cy(.5,.5,.31,0,3,ink);cy(.5,.5,.14,3,10,c);shape(.5,.5,13,.49,.49,5,[[.88,0],[1,.35],[1,.8],[.9,1]],c);ring(.5,.5,.4,18.1,gold);break;
   case 'walnut-nesting':feet(1,1,17);b(.03,.03,.94,.94,3,17,c);b(.17,.17,.66,.66,2,6,shade(c,-12));for(let j=0;j<4;j++)line([.1,.18+j*.19,20.1],[.9,.18+j*.19,20.1],shade(c,22),.008);trim(.12,.975,.76,17,2,gold);break;
   case 'bookshelf':b(.06,.08,.88,.82,3,0,wood);b(.11,.1,.78,.1,43,3,shade(c,-22));for(const u of [.06,.86])b(u,.08,.08,.82,43,3,c);for(const z of [3,16,29,43])b(.05,.07,.9,.85,2,z,c);b(.02,.04,.96,.9,3,45,shade(c,15));for(const z of [5,18,31])for(let j=0;j<5;j++){const u=.17+j*.13,h=7+(j%3);b(u,.47,.1,.35,h,z,[c,'#8ba99b','#b794ab',cream,'#728aa4'][j]);for(const dz of [1,h-1])panel(u+.01,.825,.08,z+dz,.5,gold);}break;
   case 'sage-slatted':case 'woven-seat':feet(1,1,13);for(const u of [.1,.82])b(u,.12,.07,.08,32,0,wood);for(let j=0;j<4;j++)b(.1,.12,.79,.08,2,21+j*3.5,c);b(.08,.2,.84,.71,3,13,wood);for(let j=0;j<7;j++)line([.13,.27+j*.09,16.2],[.87,.27+j*.09,16.2],c,.025);if(s==='woven-seat')for(let j=0;j<7;j++)line([.16+j*.1,.24,16.4],[.16+j*.1,.85,16.4],shade(c,25),.012);break;
   case 'flowers':case 'theme-orchid':case 'theme-fern':{
    for(let j=0;j<10;j++){const a=j*Math.PI/5;line([.5+Math.cos(a)*.25,.5+Math.sin(a)*.25,1],[.5+Math.cos(a)*.295,.5+Math.sin(a)*.295,8],gold,.008);}shape(.5,.5,0,.3,.3,9,[[.7,0],[1,1]],s==='flowers'?wood:c);cy(.5,.5,.29,9,1,wood);cy(.5,.5,.25,10,.3,'#4e5140');
    if(s==='theme-fern'){for(let j=0;j<8;j++){const a=j*Math.PI/4,du=Math.cos(a)*.48,dv=Math.sin(a)*.48;line3([[.5,.5,10],[.5+du*.5,.5+dv*.5,26],[.5+du,.5+dv,22]],green,.018);for(let k=1;k<5;k++){const u=.5+du*k/5,v=.5+dv*k/5;leaf(u,v,13+k*2.6,-dv*.4,du*.4,3,shade(c,k*4));leaf(u,v,13+k*2.6,dv*.4,-du*.4,3,c);}}}
    else {const count=s==='flowers'?5:3;for(let j=0;j<count;j++){const u=.26+j*.12,z=27+j*4;line3([[.5,.5,10],[u,.48,z],[u+.12,.5,z+5]],green,.016);leaf(.5,.5,12,(j-1)*.3,.18,5,green);flower(u+.1,.5,z+3,s==='flowers'?shade(c,j*10):'#d3a3c7');if(s==='theme-orchid')flower(u+.02,.5,z-4,'#d3a3c7');}}break;
   }
   case 'theme-trunk':for(const u of [.13,.83])for(const v of [.13,.83])b(u,v,.05,.05,20,2,gold);b(.1,.1,.8,.8,18,2,c);shape(.5,.5,20,.41,.41,4,[[1,0],[1,.3],[.85,1]],wood);for(const u of [.23,.7]){b(u,.08,.07,.84,1,24,gold);panel(u,.911,.07,3,17,wood);}trim(.13,.92,.74,4,13,gold);b(.44,.94,.12,.05,4,14,gold);for(const u of [.13,.8])panel(u,.92,.07,4,2,ink);break;
   case 'theme-fire':{
    for(const [u,v]of [[.28,.28],[.7,.7]]){puff(u,v,1,.08,.07,2,c);line([u-.08,v,3],[u+.08,v,3],ink,.02);}d([[.46,.27,6],[.5,.4,21],[.54,.73,6]],'#f4bc69');
    for(let j=0;j<8;j++){const a=j*Math.PI/4;puff(.5+Math.cos(a)*.36,.5+Math.sin(a)*.36,0,.13,.12,5,shade('#8e9b91',j%3*10));}for(const k of [-1,1])line([.2,.5+k*.2,4],[.8,.5-k*.2,5],wood,.075);for(let j=0;j<3;j++){const u=.34+j*.16;d([[u-.12,.5,6],[u-.09,.5,15],[u+.02,.5,28-j*3],[u+.13,.5,16],[u+.1,.5,6]],j===1?'#f7cd76':'#e9995b');d([[u-.04,.51,7],[u,.51,19-j*2],[u+.06,.51,7]],cream);}break;
   }
   case 'theme-waterfall':b(.04,.04,1.92,.92,4,0,shade(c,-18));b(.16,.4,1.68,.46,1,4,'#79c9cd');for(const u of [.08,1.52]){b(u,.12,.38,.35,36,4,'#7d9188');b(u-.03,.09,.44,.41,3,40,'#a5b3a0');for(let j=0;j<3;j++){line([u,.475,11+j*10],[u+.33,.475,11+j*10],'#60776d',.012);leaf(u+.1,.48,14+j*9,.17,.04,2,c);}}b(.43,.16,1.1,.22,3,36,'#6e887e');d([[.46,.4,36],[1.54,.4,36],[1.5,.65,5],[.5,.65,5]],'#72bdc7');for(let j=0;j<7;j++)line([.51+j*.15,.405,35],[.55+j*.14,.65,6],j%2?'#b2e5df':'#8ed6dc',.016);for(let j=0;j<6;j++)puff(.48+j*.2,.66,5,.08,.07,1.5,cream);break;
   case 'lily-basin':shape(.5,.5,0,.47,.47,10,[[.75,0],[1,.8],[1,1]],c);cy(.5,.5,.39,10,.6,'#497f87');ring(.5,.5,.44,10.7,cream);for(const [u,v]of [[.35,.4],[.62,.62]]){cy(u,v,.14,10.8,.3,green);line([u,v,11.2],[u+.1,v+.1,11.2],'#c0cf91',.01);}flower(.35,.4,11.3,'#e8b4ce');break;
   case 'vine-screen':for(const u of [.05,1.86])b(u,.37,.08,.17,43,0,wood);for(const z of [5,41])b(.05,.38,1.89,.1,2,z,wood);for(let j=0;j<6;j++)line([.12+j*.3,.45,7],[.12+j*.3,.45,41],gold,.014);for(const z of [13,23,33])line([.12,.46,z],[1.86,.46,z],gold,.012);for(let j=0;j<8;j++){const u=.2+j*.21,z=12+(j%4)*7;line([u,.48,4],[u+.1,.48,z+6],green,.018);leaf(u,.48,z,.16,.03,4,c);leaf(u,.48,z-5,-.16,.03,3,shade(c,18));}break;
   case 'plant-house':b(.06,.06,.88,.88,5,0,c);b(.11,.11,.78,.78,2,5,'#536f51');for(const [u,v]of [[.34,.34],[.65,.6]]){line([u,v,7],[u,v,32],green,.02);for(let j=0;j<5;j++)leaf(u,v,10+j*4,j%2?.2:-.2,j%2?.1:-.1,5,green);}for(const u of [.08,.89])for(const v of [.08,.89])b(u,v,.03,.03,31,5,gold);for(const v of [.1,.9]){d([[.1,v,7],[.9,v,7],[.9,v,36],[.1,v,36]],'#bde9df20');line3([[.1,v,36],[.5,v,43],[.9,v,36]],gold,.02);}line([.5,.1,43],[.5,.9,43],gold,.02);line([.18,.91,27],[.32,.91,20],cream,.012);break;
   case 'bed':case 'cabin-bed':case 'velvet-bed':case 'platform-bed':case 'theme-daybed':case 'poster-bed':{
    const w=g.width||1;feet(w,2,5);b(.03,.03,w-.06,1.94,5,5,s==='velvet-bed'?shade(c,-25):wood);g.mattress(10,w);
    if(s==='velvet-bed'){for(let j=0;j<6;j++)shape(.12+j*(w-.24)/6+(w-.24)/12,.14,8,(w-.24)/12,.1,31,[[.8,0],[1,.1],[1,.88],[.7,1]],c);for(let j=0;j<5;j++)panel(.24+j*.33,.25,.025,27,1,gold);}
    else if(s==='theme-daybed'){for(const v of [.08,1.82]){b(.07,v,.86,.1,17,6,wood);for(let j=0;j<5;j++)leaf(.16+j*.17,v,23,(j-2)*.06,0,7,c);}line([.1,1.9,10],[.9,1.9,10],gold,.02);}
    else {b(.03,.03,w-.06,.12,s==='platform-bed'?18:29,5,c);for(let j=0;j<Math.round(w*5);j++){const u=.1+j*(w-.2)/Math.round(w*5);grain(u,.156,.1,9,s==='platform-bed'?12:22);}b(.01,.01,w-.02,.16,2,s==='platform-bed'?23:34,shade(c,18));}
    if(s==='poster-bed'){for(const u of [.03,w-.07])for(const v of [.03,1.93]){cy(u,v,.035,2,53,gold,8);puff(u,v,55,.055,.055,3,gold);}for(const u of [.03,w-.07])line([u,.03,54],[u,1.93,54],wood,.025);for(const v of [.03,1.93])line([.03,v,54],[w-.07,v,54],wood,.025);}
    if(s==='platform-bed')for(let j=0;j<4;j++)line([.12,1.25+j*.16,20.1],[w-.12,1.25+j*.16,20.1],cream,.012);
    break;
   }
   case 'round-bed':shape(1,1,0,.96,.96,7,[[.86,0],[1,.4],[1,1]],shade(c,-25),24);shape(1,1,7,.9,.9,8,[[.9,0],[1,.25],[1,.8],[.9,1]],cream,24);cy(1,1,.85,15,2,c,24);ring(1,1,.78,17.1,shade(c,30));for(const u of [.42,1.05])cushion(u,.33,.53,.36,17,cream);cushion(.76,.91,.42,.4,17,shade(c,-25));break;
   case 'bunk-bed':for(const z of [4,34]){b(.02,.02,.96,1.96,3,z,wood);g.mattress(z+3,1);}for(const u of [.03,.91])for(const v of [.03,1.91])b(u,v,.06,.06,59,0,c);for(const u of [.03,.93]){line([u,.05,57],[u,1.9,57],c,.035);for(const v of [.25,.6,1.5,1.85])line([u,v,48],[u,v,57],wood,.02);}for(const v of [1.05,1.78])line([.99,v,0],[.99,v,57],gold,.025);for(let j=0;j<7;j++)line([.99,1.05,5+j*7],[.99,1.78,5+j*7],gold,.025);break;
   case 'capsule-bed':b(.03,.03,.94,1.94,6,0,ink);g.mattress(6,1);b(.03,.03,.94,.16,33,6,'#728ba0');for(const u of [.02,.9]){b(u,.04,.08,.65,32,6,'#728ba0');b(u,.69,.08,1.25,12,6,'#728ba0');line3([[u+.04,1.9,18],[u+.04,.7,18],[u+.04,.68,37],[u+.04,.12,37]],c,.025);}b(.02,.02,.96,.69,3,38,'#a9beca');panel(.24,.2,.52,29,5,ink);panel(.29,.21,.42,30,2,c);break;
   case 'racer-bed':b(.03,.05,.94,1.9,7,4,c);g.mattress(11,1);for(const u of [.02,.9]){d([[u,.1,12],[u,.1,25],[u,.65,24],[u,1.4,16],[u,1.92,18],[u,1.92,9]],c);line([u,.3,21],[u,1.65,14],cream,.02);for(const v of [.33,1.55]){puff(u,v,0,.07,.2,10,ink);puff(u+.01,v,2,.075,.1,5,metal);}}b(.03,1.85,.94,.12,3,15,shade(c,-15));for(const u of [.14,.7])b(u,1.98,.16,.02,2,13,'#ffe3a2');b(.18,.08,.64,.14,3,28,c);break;
   case 'show-meteor':b(.08,.08,.84,.84,3,0,ink);b(.14,.14,.72,.72,14,3,c);b(.1,.1,.8,.8,2,17,gold);g.gem(.5,.5,21,.29,24,'#7fd9d2');for(const [u,v]of [[.23,.6],[.7,.65]])g.gem(u,v,19,.11,10,'#bc9cdb');trim(.24,.865,.52,6,7,gold);panel(.32,.88,.36,9,1,cream);break;
   case 'show-orrery':cy(.5,.5,.35,0,3,ink);shape(.5,.5,3,.25,.25,15,[[1,0],[.8,.25],[.8,.8],[1,1]],c);cy(.5,.5,.39,18,2,gold);line([.5,.5,20],[.5,.5,40],metal,.02);puff(.5,.5,31,.15,.15,9,'#f3ce78');for(const [r,z]of [[.27,27],[.4,24]])ring(.5,.5,r,z,gold);break;
   case 'show-aquarium':{
    b(.04,.04,1.92,.92,3,0,ink);b(.1,.1,1.8,.8,12,3,c);for(const u of [.17,1.05]){trim(u,.91,.78,5,8,gold);panel(u+.34,.925,.09,9,1,cream);}b(.04,.04,1.92,.92,2,15,gold);b(.1,.1,1.8,.8,2,17,'#c4bd98');for(const u of [.28,1.7])for(let j=0;j<3;j++)leaf(u,.4,19,Math.cos(j*2)*.17,Math.sin(j*2)*.17,12+j*3,green);for(const [u,v]of [[.7,.4],[1.2,.65]])puff(u,v,19,.17,.12,4,'#a6b6a5');g.gem(.6,.4,29,.1,4,'#e9b98a');d([[.68,.4,31],[.85,.4,34],[.85,.4,28]],'#e9b98a');for(const v of [.08,.92])d([[.08,v,19],[1.92,v,19],[1.92,v,44],[.08,v,44]],'#8ddbe322');for(const u of [.08,1.92])d([[u,.08,19],[u,.92,19],[u,.92,44],[u,.08,44]],'#8ddbe318');for(const u of [.06,1.9])for(const v of [.06,.9])b(u,v,.04,.04,26,18,metal);b(.03,.03,1.94,.94,2,44,ink);line([.18,.94,29],[.35,.94,39],'#d5efdf',.01);break;
   }
   case 'show-gallery':b(.03,.04,1.94,.92,3,0,ink);for(const u of [.04,1.88])b(u,.06,.08,.86,40,3,c);for(const z of [3,23,43])b(.04,.05,1.92,.9,2,z,c);b(.04,.06,1.92,.05,40,3,shade(c,-25));g.gem(.48,.5,25,.15,12,'#9bd3d1');cy(1.4,.5,.16,25,7,gold);puff(1.4,.5,32,.2,.15,6,cream);for(let j=0;j<3;j++)b(.2+j*.13,.5,.1,.28,11-j,5,['#a3b99e',cream,'#cb9dad'][j]);cy(1.4,.5,.2,5,2,gold);cy(1.4,.5,.13,7,6,c);for(const u of [.1,1.02]){d([[u,.93,5],[u+.85,.93,5],[u+.85,.93,42],[u,.93,42]],'#d3ecea16');trim(u,.94,.85,5,37,gold);}break;
   case 'trophy':b(.09,.09,.82,.82,3,0,ink);b(.17,.17,.66,.66,3,3,shade(c,-30));cy(.5,.5,.2,6,2,c);cy(.5,.5,.065,8,11,c);shape(.5,.5,17,.3,.3,15,[[.2,0],[.7,.25],[1,1]],c);ring(.5,.5,.3,32,gold);cy(.5,.5,.25,31.5,.3,shade(c,-40));for(const k of [-1,1])line3([[.5+k*.28,.5,29],[.5+k*.43,.5,29],[.5+k*.42,.5,21],[.5+k*.2,.5,19]],c,.035);panel(.31,.84,.38,3.5,2,gold);break;

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
   case 'theme-banana':for(let j=0;j<6;j++){const a=j*Math.PI/3;line3([[.48,.48,34],[.48+Math.cos(a)*.32,.48+Math.sin(a)*.32,40],[.48+Math.cos(a)*.63,.48+Math.sin(a)*.63,36]],'#b6c18b',.012);}b(.16,.16,.68,.68,7,0,c);b(.2,.2,.6,.6,1,7,'#514c3e');line([.5,.5,7],[.48,.48,36],'#a6a16b',.055);for(let j=0;j<8;j++){const a=j*Math.PI/4;leaf(.48,.48,33,Math.cos(a)*.65,Math.sin(a)*.65,5+j%3*3,shade(green,j%3*10));}for(let j=0;j<5;j++)line3([[.52+j*.05,.65,26],[.56+j*.05,.72,22],[.63+j*.05,.72,21]],'#f4cc68',.025);grain(.2,.845,.6,1,5);break;
   case 'theme-mask':for(const k of [-1,1])line3([[.5+k*.23,.67,27],[.5+k*.3,.67,26],[.5+k*.22,.67,24]],'#b87551',.022);b(.38,.35,.24,.2,18,0,wood);cy(.5,.5,.32,0,3,wood);shape(.5,.48,14,.35,.14,29,[[.2,0],[.8,.2],[1,.7],[.7,.92],[.2,1]],c);for(const u of [.28,.58]){panel(u,.627,.16,30,5,cream);panel(u+.05,.64,.055,31,2,ink);}b(.46,.62,.08,.12,9,23,wood);line3([[.32,.64,21],[.5,.66,19],[.68,.64,21]],cream,.025);for(let j=0;j<3;j++)for(const k of [-1,1])line([.5+k*.26,.63,24+j*3],[.5+k*.32,.63,25+j*3],gold,.018);break;
   case 'theme-fan':for(let j=0;j<17;j++){const a=Math.PI*j/16;line([1+Math.cos(a)*.52,.515,8+Math.sin(a)*20],[1+Math.cos(a+.04)*.85,.515,8+Math.sin(a+.04)*34],cream,.008);}b(.15,.25,1.7,.5,3,0,wood);for(let j=0;j<13;j++){const a=Math.PI*j/12,u=1+Math.cos(a)*.9,z=8+Math.sin(a)*36;d([[1,.47,6],[u,.47,z],[1+Math.cos(a+.12)*.9,.47,8+Math.sin(a+.12)*36]],shade(c,j%3*7));line([1,.49,6],[u,.49,z],wood,.015);}for(const r of [.45,.7,.9]){const p=[];for(let j=0;j<=12;j++){const a=Math.PI*j/12;p.push([1+Math.cos(a)*r,.5,8+Math.sin(a)*36*r/.9]);}line3(p,gold,.012);}break;
   case 'theme-seat':for(const u of [.08,.84])line3([[u,.78,1],[u-.03,.66,10],[u,.2,27],[u+.04,.18,38]],wood,.045);feet();b(.12,.12,.76,.15,30,6,wood);b(.12,.25,.76,.66,4,11,wood);cushion(.17,.28,.66,.59,15);for(const u of [.04,.84])b(u,.15,.12,.75,5,22,wood);for(let j=0;j<5;j++)leaf(.18+j*.15,.15,34,(j-2)*.09,.05,8,green);grain(.16,.276,.68,21,12);break;
   case 'theme-idol':for(const u of [.12,.78])shape(u,.5,5,.13,.16,16,[[.8,0],[1,.5],[.6,1]],shade(c,-12));b(.08,.08,.84,.84,4,0,'#71877b');shape(.5,.5,4,.3,.25,20,[[.95,0],[.8,.5],[1,1]],c);shape(.5,.5,24,.37,.29,16,[[.85,0],[1,.7],[.65,1]],'#91a99b');for(const u of [.24,.58]){b(u,.77,.18,.025,2,34,ink);b(u,.78,.18,.025,1,37,gold);}b(.45,.78,.1,.1,6,27,c);line([.32,.79,27],[.68,.79,27],ink,.015);for(let j=0;j<5;j++)leaf(.2+j*.13,.45,39,.08,.1,3,green);leaf(.28,.4,11,-.25,.1,4,green);break;
   case 'theme-terrarium':for(const [u,v]of [[.25,.65],[.65,.35]]){puff(u,v,7,.12,.1,3,'#b5b799');flower(u,v,15,'#c5a0bf');}b(.06,.06,.88,.88,4,0,c);b(.1,.1,.8,.8,2,4,'#637d59');for(const [u,v]of [[.32,.35],[.65,.6]])for(let j=0;j<5;j++)leaf(u,v,8+j*3,Math.cos(j*1.7)*.24,Math.sin(j*1.7)*.24,5,green);for(const u of [.08,.88])for(const v of [.08,.88])b(u,v,.04,.04,32,4,gold);for(const v of [.1,.9]){d([[.1,v,36],[.5,v,46],[.9,v,36]],'#b7e7d72b');line3([[.1,v,36],[.5,v,46],[.9,v,36]],gold,.025);d([[.1,v,6],[.9,v,6],[.9,v,36],[.1,v,36]],'#b7e7d718');}line([.5,.1,46],[.5,.9,46],gold,.025);line([.18,.91,28],[.38,.91,19],'#d5f9eb',.015);break;
   case 'theme-arch':for(let j=0;j<7;j++){const u=.2+j*.26;leaf(u,.6,42,.16,.1,4,shade(green,j%3*12));if(j%2)flower(u,.7,43,'#d9bb8d');}for(const u of [.08,1.72]){b(u,.15,.2,.7,42,0,wood);grain(u,.855,.2,1,39);}b(.05,.2,1.9,.4,5,42,c);for(let j=0;j<11;j++)leaf(.12+j*.17,.6,46,.18,.05,j%2?-5:3,green);for(const u of [.2,1.8])for(let j=0;j<5;j++){line([u,.86,7+j*7],[u-.06,.86,14+j*7],green,.025);leaf(u,.86,9+j*7,j%2?.18:-.18,0,4,green);}break;
   case 'theme-nest':for(let j=0;j<7;j++){const v=.21+j*.06;line3([[.23,v,16],[.13,v,24],[.28,v,35],[.5,v,40],[.72,v,35],[.87,v,24],[.77,v,16]],shade(wood,j%2?20:0),.016);}b(.1,.1,.8,.8,3,0,wood);line3([[.5,.12,3],[.5,.12,49],[.5,.55,51],[.5,.6,42]],gold,.05);for(let j=0;j<9;j++){const a=Math.PI+j*Math.PI/8;const u=.5+Math.cos(a)*.38,v=.5+Math.sin(a)*.34;line3([[.5+(u-.5)*.6,.5+(v-.5)*.6,12],[u,v,19],[u,v,29],[.5+(u-.5)*.55,.5+(v-.5)*.55,38],[.5,.5,42]],wood,.028);}for(const [z,r]of [[15,.8],[20,1],[26,1],[32,.85],[37,.55]]){const p=[];for(let j=0;j<=12;j++){const a=Math.PI+j*Math.PI/12;p.push([.5+Math.cos(a)*.38*r,.5+Math.sin(a)*.34*r,z]);}line3(p,gold,.014);}cushion(.18,.25,.64,.62,13);cushion(.3,.24,.4,.24,19,cream);break;
   case 'theme-fruit':line3([[1.85,.2,16],[2,.2,23],[2,.8,23],[1.85,.8,16]],wood,.03);feet(2,1,14);b(.04,.04,1.92,.92,3,14,c);for(const u of [.1,1.65]){cy(u,.82,.16,0,4,ink);cy(u,.82,.07,4,.6,gold);}for(let j=0;j<3;j++){const u=.1+j*.6;b(u,.1,.55,.8,2,17,wood);for(const v of [.1,.84])b(u,v,.55,.04,5,17,gold);for(const [dx,v]of [[.14,.3],[.38,.3],[.25,.63]]){puff(u+dx,v,19,.115,.115,6,j===0?'#e6b957':j===1?'#d98965':'#98b57a');leaf(u+dx,v,25,.07,.03,1,green);}}grain(.08,.965,1.8,14,3);break;
   case 'theme-bridge':for(let j=0;j<8;j++){const z=6.7+Math.abs(j-3.5);for(const v of [.22,.72])cy(j*.25+.12,v,.018,z,.3,ink,6);}for(let j=0;j<8;j++){const z=4+Math.abs(j-3.5);b(j*.25,.08,.23,.84,2.5,z,c);grain(j*.25,.925,.23,z,2);}for(const u of [.04,1.88])for(const v of [.08,.9]){b(u,v,.08,.08,29,0,wood);for(const z of [23,25])line([u-.02,v-.02,z],[u+.1,v+.1,z],gold,.025);}for(const v of [.1,.94]){const p=[];for(let j=0;j<=10;j++)p.push([.08+j*.184,v,25-5*Math.sin(j*Math.PI/10)]);line3(p,gold,.025);for(let j=1;j<7;j++)line([j*.27,v,21],[j*.27,v,9],gold,.012);}break;
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
  const stroke=(a,b,tint,alpha=.7,width=.7)=>{const p=point(...a),q=point(...b);ctx.globalAlpha=alpha;ctx.strokeStyle=tint;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();};
  if(s==='theme-waterfall'){
   for(let j=0;j<6;j++){const phase=(t*.55+j*.17)%1,z=34-phase*26,v=.4+phase*.22;stroke([.57+j*.16,v,z],[.57+j*.16,v+.025,z-3],'#e1fff3',.5,.7);}
   for(let j=0;j<3;j++)dot(.7+j*.3,.7,5.5,1+Math.sin(t*2+j)*.25,'#e5fff1',.4);
  }else if(s==='theme-fire'){
   for(let j=0;j<3;j++){const p=(t*.42+j*.33)%1;dot(.5+Math.sin(t+j)*.09,.5,9+p*18,1.6-p,'#ffe4a0',(1-p)*.7);}
  }else if(s==='show-aquarium'){
   for(let j=0;j<3;j++){const p=(t*.17+j*.31)%1;dot(1.65,.67,22+p*19,.65,'#d3faf2',(1-p)*.65);}
   const u=1+Math.sin(t*.35)*.55,z=31+Math.cos(t*.6)*2,dir=Math.cos(t*.35)>=0?1:-1;
   stroke([u-dir*.12,.72,z],[u+dir*.08,.72,z],'#f1c888',.9,2.5);
   stroke([u-dir*.12,.72,z],[u-dir*.23,.72,z+2],'#e5a779',.9,1.3);
   stroke([u-dir*.12,.72,z],[u-dir*.23,.72,z-2],'#e5a779',.9,1.3);
  }else if(s==='lily-basin'){
   const radius=.13+((t*.12)%1)*.15;for(let j=0;j<12;j++){const a=j*Math.PI/6,b=a+Math.PI/6;stroke([.65+Math.cos(a)*radius,.4+Math.sin(a)*radius,11],[.65+Math.cos(b)*radius,.4+Math.sin(b)*radius,11],'#d1eee1',.3);}
  }else if(s==='show-orrery'){
   dot(.5+Math.cos(t*.38)*.4,.5+Math.sin(t*.38)*.4,24,1.8,'#9dcfda');dot(.5+Math.cos(t*.55+2)*.27,.5+Math.sin(t*.55+2)*.27,27,1.3,'#e6b5cd');
  }else if(s==='plant-house'){
   for(let j=0;j<2;j++)dot(.35+j*.3+Math.sin(t*.6+j)*.05,.6,18+j*8+Math.cos(t+j),.8,'#f5e5b4',pulse*.6);
  }else if(s==='show-meteor'){
   stroke([.43,.65,31],[.53,.65,35],'#e2fff1',pulse*.6);dot(.5,.52,42,1.3,'#d0fff1',pulse*.35);
  }else if(s==='capsule-bed'){
   stroke([.3,.22,31],[.7,.22,31],'#c8fffa',pulse*.5);dot(.94,1.5,18,1,'#b8fff0',pulse*.6);
  }else if(s==='trophy'){
   const a=.2+Math.sin(t*.8)*.06;stroke([.5+a,.6,27],[.5+a,.6,30],'#fff3c7',pulse*.55);
  }else
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
