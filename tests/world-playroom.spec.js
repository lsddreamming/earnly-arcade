const {test,expect}=require('@playwright/test');
test('Playroom collection has ten distinct, recolorable, unclipped models in four directions',async({page})=>{
 await page.route('https://**',r=>r.abort());await page.goto('/world.html?catalog=Playroom');
 await expect(page.locator('#panelContent')).toContainText('Neon Dice Pedestal');
 const result=await page.evaluate(()=>{
  const problems=[],art=new Set();const items=EarnlyWorldCollections.playroomItems;
  const render=(item,rotation,color)=>{const c=document.createElement('canvas');EarnlyWorldRenderer.thumbnail(c,{...item,rotation,color});const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0,edge=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]){count++;if(!x||!y||x===c.width-1||y===c.height-1)edge++;}if(count<50||edge)problems.push(item.id+' clipped/empty '+rotation);return c.toDataURL();};
  for(const item of items){const views=[0,2,4,6].map(r=>render(item,r,item.color));if(views.every((v,i)=>v===render(item,i*2,'#d9a0b5')))problems.push(item.id+' color');art.add(views.join('|'));}
  return {count:items.length,unique:art.size,problems};
 });expect(result).toEqual({count:10,unique:10,problems:[]});
 await page.screenshot({path:'test-results/playroom-catalog.png',fullPage:true});
});

test('Dice and dispenser controls send intents and replay shared results before room welcome',async({page})=>{
 const fs=require('fs');
 await page.route('**/world-renderer.js*',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync('world-renderer.js','utf8')+';{const Base=EarnlyWorldRenderer.WorldRenderer;EarnlyWorldRenderer.WorldRenderer=class extends Base{constructor(...a){super(...a);window.testRenderer=this;}};}'}));
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  window.intents=[];
  window.WebSocket=class extends EventTarget{
   static OPEN=1;constructor(){super();this.readyState=1;window.testSocket=this;setTimeout(()=>this.onopen?.(),10);}
   emit(p){this.onmessage?.({data:JSON.stringify(p)});}
   close(){}
   send(raw){const p=JSON.parse(raw);if(p.type==='JOIN'){
    const items=['neon-dice','soft-serve','neon-roller'].map((id,j)=>({...EarnlyWorldCollections.playroomItems.find(i=>i.id===id),definitionId:id,sprite:'play-'+id,x:j+1,y:1,z:0,rotation:0,itemHeight:1.5}));
    this.emit({type:'FURNITURE_RESULT',itemId:'neon-dice',kind:'dice',value:4,snapshot:true});
    this.emit({type:'WELCOME',userId:'u',scene:{roomId:'r',ownerId:'u',name:'Playroom',heightmap:'00000\n00000\n00000\n00000',items},bootstrap:{balance:100,rooms:[],items:[],catalog:[],friends:[]}});
    this.emit({type:'ROOM_SNAPSHOT',users:[{userId:'u',username:'Tester',position:{x:1,y:2,z:0},state:'std'}]});
   }else if(p.type==='INTERACT'){window.intents.push(p);this.emit({type:'FURNITURE_RESULT',itemId:p.action==='roll'?'neon-dice':'soft-serve',userId:'u',kind:p.action==='roll'?'dice':'serve',value:p.action==='roll'?6:0});}
   else if(p.type==='MOVE_TO')window.intents.push(p);
   }
  };
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#worldConnected')).toBeVisible();
 expect(await page.evaluate(()=>testRenderer.scene.items[0].diceValue)).toBe(4);
 const tap=async id=>page.evaluate(id=>{const r=testRenderer,item=r.scene.items.find(i=>i.id===id);r.onTap({item,x:item.x,y:item.y});},id);
 await page.evaluate(()=>{testRenderer.viewRotation=1;testRenderer.cameraScene();});
 await tap('neon-dice');await page.getByRole('button',{name:'Roll dice · Free',exact:true}).click();await expect(page.locator('#worldToast')).toContainText('Rolled 6');expect(await page.evaluate(()=>testRenderer.scene.items[0].diceValue)).toBe(6);expect(await page.evaluate(()=>testRenderer.cameraScene().items[0].diceValue)).toBe(6);
 await tap('soft-serve');await page.getByRole('button',{name:'Serve ice cream · Free',exact:true}).click();await expect(page.locator('#worldToast')).toContainText('Ice cream served');
 await tap('neon-roller');await page.getByRole('button',{name:'Step onto roller',exact:true}).click();
 expect(await page.evaluate(()=>window.intents)).toEqual([{type:'INTERACT',x:1,y:1,action:'roll'},{type:'INTERACT',x:2,y:1,action:'serve'},{type:'MOVE_TO',x:3,y:1}]);
 await page.evaluate(()=>testSocket.emit({type:'FURNITURE_RESULT',error:'Walk beside the piece, then tap Use.'}));await expect(page.locator('#worldToast')).toContainText('Walk beside');
});
