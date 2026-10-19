const {test,expect}=require('@playwright/test');
test('room animals animate, face their walking direction, and remain distinct from visitors',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',r=>r.abort());await page.goto('/world.html');
 const result=await page.evaluate(async()=>{
  document.querySelector('#worldEntry').hidden=true;document.querySelector('#worldConnected').hidden=false;
  const r=new EarnlyWorldRenderer.WorldRenderer(document.querySelector('#worldCanvas'),()=>{});window.petPreview=r;
  r.setScene({roomId:'animals-test',name:'Companions',theme:'patio',heightmap:Array(6).fill('000000').join('\n'),items:[]});r.resize();
  const pets=['dog','cat','rabbit'].map((species,i)=>({staffId:'pet-'+i,username:['Biscuit','Mochi','Clover'][i],species,isStaff:true,color:['#cc965c','#8c98b2','#eee0cd'][i],position:{x:2+i,y:2,z:0},state:'std'}));
  r.setStaff(pets);r.bubble({userId:'pet-0',text:'Woof!',mode:'pet'});const words=[],fill=r.c.fillText.bind(r.c);r.c.fillText=(text,...args)=>{words.push(text);fill(text,...args);};r.draw();if(!words.includes('Woof!'))throw Error('Pet bubble missing');r.c.fillText=fill;r.setStaff(pets.map(p=>({...p,position:{...p.position,x:p.position.x-1}})));
  const pet=r.staff.get('pet-0'),middle=r.sample(pet,pet.at+350);r.draw();
  return {middle:middle.x,facing:pet.facing,humans:r.users.size,animals:r.staff.size};
 });
 expect(result).toEqual({middle:1.5,facing:'left',humans:0,animals:3});
 await page.waitForTimeout(800);await page.evaluate(()=>{petPreview.draw();});
 await page.locator('#worldCanvas').screenshot({path:info.outputPath('animals.png')});
 for(let q=0;q<4;q++)await page.evaluate(()=>{petPreview.rotateView(1);petPreview.draw();});
 expect(errors).toEqual([]);
});
