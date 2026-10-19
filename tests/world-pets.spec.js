const {test,expect}=require('@playwright/test');
async function fixture(page,{full=false,ready=true,interactions=false,visitor=false}={}){
 await page.route('https://**',r=>r.abort());
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(({full,ready,interactions,visitor})=>{
  const home='00000000-0000-4000-8000-000000000001';
  window.petActions=[];
  const catalog=[{id:'dog',name:'Cloud Pup',price:500,color:'#cc965c'},{id:'cat',name:'Moon Cat',price:500,color:'#8c98b2'},{id:'rabbit',name:'Meadow Bunny',price:350,color:'#eee0cd'}];
  const bootstrap={personalPets:ready,petInteractions:interactions,petsEnabled:true,balance:2000,catalog:[],items:[],rooms:[{id:home,name:'Home',ownerId:'owner'}],friends:[],petCatalog:catalog,pets:full?[0,1,2,3].map(i=>({id:'pet'+i,name:'Pup '+i,species:'dog',room_id:i<3?home:null})):[]};
  window.WebSocket=class{static OPEN=1;constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}send(raw){const p=JSON.parse(raw),emit=data=>this.onmessage?.({data:JSON.stringify(data)});
   if(p.type==='JOIN'){emit({type:'WELCOME',userId:visitor?'guest':'owner',scene:{roomId:home,name:'Home',ownerId:'owner',heightmap:'000000\n000000\n000000\n000000\n000000\n000000',items:[]},bootstrap});emit({type:'NPC_SNAPSHOT',staff:[{staffId:'pet-dog',petId:'dog',ownerId:'owner',username:'Biscuit',species:'dog',role:'Pet dog',position:{x:2,y:2,z:0},state:'std'}]});}
   if(p.type==='ACTION'){window.petActions.push(p);let result=bootstrap;
    if(p.action==='staff_talk')result={name:'Biscuit',role:'Pet dog',greeting:'Hello',tip:'Companion',canPet:true,canCall:!visitor};
    if(p.action==='pet_interact'){result={message:'Biscuit is happy'};if(p.data.kind==='pet')emit({type:'PET_REACTION',staffId:'pet-dog',reaction:'happy'});}
    if(p.action==='pet_buy'){const d=catalog.find(d=>d.id===p.data.species);bootstrap.balance-=d.price;bootstrap.pets.push({id:'adopted',species:d.id,name:d.name,room_id:null});result={pet_id:'adopted'};}
    if(p.action==='pet_rename')bootstrap.pets.find(pet=>pet.id===p.data.petId).name=p.data.name;
    if(p.action==='pet_place')bootstrap.pets.find(pet=>pet.id===p.data.petId).room_id=home;
    if(p.action==='pet_pickup')bootstrap.pets.find(pet=>pet.id===p.data.petId).room_id=null;
    emit({type:'RESULT',requestId:p.requestId,data:result});
   }
  }};
 },{full,ready,interactions,visitor});
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#connectionStatus')).toContainText('Live');
}
test('Pet Shop and Backpack support confirmed adoption, naming, placement and safe pickup',async({page})=>{
 await fixture(page);await page.locator('[data-panel="catalog"]').click();await page.getByRole('button',{name:'Pet Shop',exact:true}).click();await expect(page.locator('.pet-card')).toHaveCount(3);
 await page.getByRole('button',{name:'Adopt Cloud Pup',exact:true}).click();expect(await page.evaluate(()=>petActions.filter(p=>p.action==='pet_buy').length)).toBe(0);
 await page.getByRole('button',{name:'Adopt for 500 Coins',exact:true}).click();await expect(page.locator('#coinBalance')).toHaveText('◇ 1,500');await expect(page.locator('.pet-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Rename',exact:true}).click();await page.getByRole('textbox',{name:'Pet name'}).fill('Biscuit');await page.getByRole('button',{name:'Save name'}).click();await expect(page.locator('.pet-card h3')).toHaveText('Biscuit');
 await page.getByRole('button',{name:'Place in room'}).click();await expect(page.locator('#worldPanel')).not.toBeVisible();await page.locator('[data-panel="backpack"]').click();await page.getByRole('button',{name:'Pets',exact:true}).click();await expect(page.locator('.pet-card')).toContainText('Roaming in this room');await page.getByRole('button',{name:'Return to Backpack'}).click();await expect(page.locator('.pet-card')).toContainText('In Backpack');await expect(page.locator('#coinBalance')).toHaveText('◇ 1,500');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>petActions.filter(p=>p.action==='pet_buy').length)).toBe(1);
});
test('three placed pets disable further placement with a readable explanation',async({page})=>{
 await fixture(page,{full:true});await page.locator('[data-panel="backpack"]').click();await page.getByRole('button',{name:'Pets',exact:true}).click();const stored=page.locator('.pet-card').filter({hasText:'Pup 3'});await expect(stored.getByRole('button',{name:'Place in room'})).toBeDisabled();await expect(stored).toContainText('3 pets are already roaming here.');
});
test('pet purchases remain hidden until the connected server supports them',async({page})=>{
 await fixture(page,{ready:false});await page.locator('[data-panel="catalog"]').click();await expect(page.getByRole('button',{name:'Pet Shop',exact:true})).toHaveCount(0);
});

test('pet shop fits three clear choices on a phone without oversized cards',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);await page.locator('[data-panel="catalog"]').click();await expect(page.locator('.catalog-refine')).not.toHaveAttribute('open','');await page.getByRole('button',{name:'Pet Shop',exact:true}).click();
 await expect(page.locator('.pet-card')).toHaveCount(3);await expect(page.locator('.pet-card').last().getByRole('button')).toBeInViewport();await page.screenshot({path:info.outputPath('calm-pet-shop.png')});
 expect(await page.locator('#worldPanel').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});

test('owner can call and pet from a compact companion panel without spending coins',async({page},info)=>{
 await fixture(page,{interactions:true});await page.locator('[data-panel="staff"]').click();await page.getByRole('button',{name:'Meet pet',exact:true}).click();await expect(page.getByRole('button',{name:'Call over',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Pet',exact:true})).toBeEnabled();await page.screenshot({path:info.outputPath('pet-interactions.png')});
 await page.getByRole('button',{name:'Call over',exact:true}).click();await expect(page.locator('#worldPanel')).not.toBeVisible();await page.locator('[data-panel="staff"]').click();await page.getByRole('button',{name:'Meet pet',exact:true}).click();await page.getByRole('button',{name:'Pet',exact:true}).click();await expect(page.locator('#worldPanel')).not.toBeVisible();await expect(page.locator('#coinBalance')).toHaveText('◇ 2,000');expect(await page.evaluate(()=>petActions.filter(p=>p.action==='pet_interact').map(p=>p.data.kind))).toEqual(['call','pet']);
});
test('visitors can pet but do not receive the owner call action',async({page})=>{
 await fixture(page,{interactions:true,visitor:true});await page.locator('[data-panel="staff"]').click();await page.getByRole('button',{name:'Meet pet',exact:true}).click();await expect(page.getByRole('button',{name:'Pet',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Call over',exact:true})).toHaveCount(0);
});
test('interaction controls wait for server capability',async({page})=>{
 await fixture(page);await page.locator('[data-panel="staff"]').click();await page.getByRole('button',{name:'Meet pet',exact:true}).click();await expect(page.getByRole('button',{name:'Pet',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Call over',exact:true})).toHaveCount(0);
});
