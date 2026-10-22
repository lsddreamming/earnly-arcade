const {test,expect}=require('@playwright/test');
test('themed furniture has distinct art, working colors and complete four-direction previews',async({page})=>{
 await page.goto('/world.html');
 const result=await page.evaluate(()=>{
  const {themedItems,collections,vignette,bedItems}=EarnlyWorldCollections;
  const problems=[],art=new Map();
  const render=(item,rotation,color)=>{
   const c=document.createElement('canvas');EarnlyWorldRenderer.thumbnail(c,{...item,rotation,color});
   const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let visible=0,edge=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(pixels[(y*c.width+x)*4+3]){visible++;if(x===0||y===0||x===c.width-1||y===c.height-1)edge++;}}
   if(visible<50||edge)problems.push(item.id+' '+rotation+' missing/clipped art');
   return c.toDataURL();
  };
  for(const item of themedItems){
   const views=[0,2,4,6].map(r=>render(item,r,'#80c9b5'));
   if(views.every((v,r)=>v===render(item,r*2,'#d9a0b5')))problems.push(item.id+' ignores color');
   const key=views.join('|');if(art.has(key))problems.push(item.id+' duplicates '+art.get(key));art.set(key,item.id);
  }
  // Tall and wide legacy pieces used to lose edges in the fixed preview box.
  const legacy=[{id:'ficus-tree',sprite_id:'tree',width:1,length:1},{id:'boardwalk-lamp',sprite_id:'lamp',width:1,length:1},{id:'garden-parasol',sprite_id:'umbrella',width:1,length:1}];
  for(const item of [...EarnlyWorldCollections.allItems,...legacy])for(const rotation of [0,2,4,6])render(item,rotation,item.color||'#80c9b5');
  for(const set of collections.filter(s=>['Canopy Jungle','Timber Lodge','Moonveil Gothic','Roast & Gather'].includes(s.name))){if(set.ids.length!==16||vignette(set).length!==4)problems.push(set.name+' incomplete');}
  if(collections.find(s=>s.name==='Dream Rooms').ids.length!==bedItems.length)problems.push('Missing featured beds');
  return {count:themedItems.length,unique:new Set(themedItems.map(i=>i.id)).size,problems};
 });
 expect(result).toEqual({count:64,unique:64,problems:[]});
});
