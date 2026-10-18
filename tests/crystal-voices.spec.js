const {test,expect}=require('@playwright/test');
async function fakeSpeech(page){await page.addInitScript(()=>{
 window.spoken=[];window.voiceCancels=0;
 window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'Local A',lang:'en-US',localService:true},{name:'Local B',lang:'en-US',localService:true},{name:'Local C',lang:'en-US',localService:true}],speak:u=>{if(u.volume!==0)window.spoken.push({text:u.text,voice:u.voice?.name,pitch:u.pitch});setTimeout(()=>u.onend?.(),5)},cancel:()=>window.voiceCancels++}});
});}
test('Construction, completed buildings and recruits announce once without enemy chatter',async({page})=>{
 await fakeSpeech(page);await page.goto('/crystal-command.html');await page.locator('#practice').click();
 await page.evaluate(()=>{CrystalGame.state.players[0].crystals=10000;CrystalGame.issue({type:'build',kind:'factory',x:9,y:6})});
 await expect.poll(()=>page.evaluate(()=>spoken.some(s=>/War factory.*(ground|Construction|foundation)/i.test(s.text)))).toBe(true);
 await page.evaluate(()=>{CrystalGame.state.entities.find(e=>e.side===0&&e.type==='factory').build=.01});
 await expect.poll(()=>page.evaluate(()=>spoken.some(s=>/War factory.*(complete|online|secured)/i.test(s.text)))).toBe(true);
 await page.evaluate(()=>{const s=CrystalGame.state,f=s.entities.find(e=>e.side===0&&e.type==='factory');CrystalGame.issue({type:'train',id:f.id,kind:'laser'});f.progress=100});
 await expect.poll(()=>page.evaluate(()=>spoken.some(s=>s.text.startsWith('Striker ready.')))).toBe(true);
 const count=await page.evaluate(()=>spoken.filter(s=>s.text.startsWith('Striker ready.')).length);await page.waitForTimeout(500);expect(await page.evaluate(()=>spoken.filter(s=>s.text.startsWith('Striker ready.')).length)).toBe(count);
 await page.locator('#sound').click();const before=await page.evaluate(()=>spoken.length);await page.evaluate(()=>CrystalGame.issue({type:'move',ids:CrystalGame.state.entities.filter(e=>e.side===0&&e.type==='worker').map(e=>e.id),x:7,y:7}));await page.waitForTimeout(200);expect(await page.evaluate(()=>spoken.length)).toBe(before);expect(await page.evaluate(()=>voiceCancels)).toBeGreaterThan(0);
});
test('Faction voices vary sayings, filter enemy snapshots and keep speech queues bounded',async({page})=>{
 await fakeSpeech(page);await page.goto('/crystal-command.html');
 const result=await page.evaluate(async()=>{let time=0,caption='';const voice=CrystalVoices.create({now:()=>time,random:()=>0,caption:s=>caption=s});const s=CrystalCommand.create({factions:['prism','human']});voice.unlock('prism');voice.reset(CrystalCommand.view(s,0),0);await new Promise(r=>setTimeout(r,20));
  voice.command({type:'move'});await new Promise(r=>setTimeout(r,20));time+=2000;voice.command({type:'move'});await new Promise(r=>setTimeout(r,20));
  const base=CrystalCommand.view(s,0),before=spoken.length;base.entities.push({id:9999,type:'laser',side:1,build:0});voice.observe(base,0);await new Promise(r=>setTimeout(r,20));const noEnemy=spoken.length===before;
  voice.warning('More crystals needed');await new Promise(r=>setTimeout(r,20));const warning=caption;voice.stop();return{lines:spoken.map(s=>s.text),voices:spoken.map(s=>s.voice),noEnemy,warning,cleared:caption===''};});
 expect(result.lines).toContain('Following the brightest path.');expect(result.lines).toContain('Our vectors converge.');expect(result.noEnemy).toBe(true);expect(result.warning).toContain('crystals');expect(result.cleared).toBe(true);expect(new Set(result.voices).size).toBeGreaterThan(1);
});
test('Unavailable speech still gives a completion caption and does not break play',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true})});await page.goto('/crystal-command.html');await page.locator('#learn').click();
 await page.evaluate(()=>{CrystalGame.state.players[0].crystals=10000;CrystalGame.issue({type:'build',kind:'factory',x:9,y:6})});await expect(page.locator('#voiceCaption')).toContainText('War factory');
 await page.evaluate(()=>{CrystalGame.state.entities.find(e=>e.side===0&&e.type==='factory').build=.01});await expect(page.locator('#voiceCaption')).toContainText(/complete|online|secured/);expect(await page.evaluate(()=>CrystalGame.running)).toBe(true);
});
test('Completion messages outrank movement chatter and pause cancels speech',async({page})=>{
 await fakeSpeech(page);await page.goto('/crystal-command.html');
 const result=await page.evaluate(()=>{const held=[];speechSynthesis.speak=u=>{if(u.volume!==0)held.push(u)};const voice=CrystalVoices.create();voice.unlock('human');voice.say('busy',['Current message']);for(let i=0;i<50;i++)voice.say('move'+i,['Move '+i],{priority:0});voice.say('complete',['Factory ready'],{priority:2});held[0].onend();const next=held[1].text;held[1].onend();held[2].onend();held[3].onend();const count=held.length;voice.stop();return{next,count};});
 expect(result.next).toBe('Factory ready');expect(result.count).toBe(4);
 await page.locator('#practice').click();const before=await page.evaluate(()=>voiceCancels);await page.locator('#pause').click();expect(await page.evaluate(()=>voiceCancels)).toBeGreaterThan(before);await expect(page.locator('#voiceCaption')).toBeHidden();
});
