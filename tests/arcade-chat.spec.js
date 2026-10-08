const {test,expect}=require('@playwright/test');
async function setup(page,{signed=true,accepted=true}={}){
 await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'text/javascript',body:`
window.chatCalls=[];window.chatUser=${signed?"'u1'":"null"};window.chatFail=false;
window.chatData={accepted:${accepted},username:'Justin',muted:false,blocked:[],messages:[{id:'m1',user_id:'u2',username:'Rival',body:'Who wants a Crystal Command match?',created_at:'2026-10-08T20:00:00Z',equipped:{avatar:{id:'russet-potato',imageUrl:'cosmetic-russet-potato.svg'}}}]};
window.EarnlyCloud={session:async()=>window.chatUser?{user:{id:window.chatUser}}:null,client:{rpc:async(name,args)=>{
 window.chatCalls.push(args);const d=args.p_data,a=args.p_action;
 if(window.chatFail)return {error:{message:'Connection interrupted. Try again.'}};
 if(a==='feed')return {data:JSON.parse(JSON.stringify(window.chatData))};
 if(a==='accept')window.chatData.accepted=true;
 if(a==='mute')window.chatData.muted=d.muted;
 if(a==='send')window.chatData.messages.push({id:'sent',user_id:'u1',username:'Justin',body:d.body,created_at:new Date().toISOString(),equipped:{}});
 if(a==='block'){window.chatData.blocked.push({user_id:d.user_id,username:'Rival'});window.chatData.messages=[];}
 if(a==='unblock')window.chatData.blocked=[];
 if(a==='report'||a==='delete')window.chatData.messages=window.chatData.messages.filter(m=>m.id!==d.message_id);
 return {data:{ok:true}};
}}};`}));
 await page.goto('/games.html');await page.locator('#arcadeChatButton').click();
}
test('guest sees sign in, confirmed player accepts rules before sending',async({page})=>{
 await setup(page,{signed:false});await expect(page.getByRole('link',{name:'Sign in / Create account'})).toBeVisible();await expect(page.locator('#chatMessage')).toBeHidden();
 await page.evaluate(()=>{window.chatUser='u1';window.chatData.accepted=false;window.dispatchEvent(new Event('earnly-cloud-auth-change'));});
 await expect(page.getByRole('button',{name:'I agree — join chat'})).toBeVisible();await expect(page.locator('#chatMessage')).toBeHidden();
 await page.getByRole('button',{name:'I agree — join chat'}).click();await expect(page.locator('#chatMessage')).toBeVisible();
});
test('send preserves failure draft, retries same ID, and renders text safely',async({page})=>{
 await setup(page);await page.evaluate(()=>window.chatFail=true);const text='<img src=x onerror=alert(1)> hello';await page.locator('#chatMessage').fill(text);await page.locator('.chat-send').click();
 await expect(page.locator('.chat-status')).toContainText('interrupted');await expect(page.locator('#chatMessage')).toHaveValue(text);
 await page.evaluate(()=>window.chatFail=false);await page.locator('.chat-send').click();await expect(page.locator('.chat-body').last()).toHaveText(text);await expect(page.locator('#chatMessage')).toHaveValue('');expect(await page.locator('.chat-body img').count()).toBe(0);
 const calls=await page.evaluate(()=>window.chatCalls.filter(x=>x.p_action==='send'));expect(calls.length).toBe(2);expect(calls[0].p_data.request_id).toBe(calls[1].p_data.request_id);
});
test('blocking, unblocking, reporting and muting have visible results',async({page})=>{
 await setup(page);await page.getByLabel('Actions for message by Rival').click();await page.getByRole('button',{name:'Block @Rival'}).click();await expect(page.locator('.chat-body')).toHaveCount(0);
 await page.locator('.chat-settings summary').click();await expect(page.getByRole('button',{name:'Unblock @Rival'})).toBeVisible();await page.getByRole('button',{name:'Unblock @Rival'}).click();await expect(page.getByRole('button',{name:'Unblock @Rival'})).toHaveCount(0);
 await page.getByRole('button',{name:'Mute chat notifications'}).click();await expect(page.getByRole('button',{name:'Unmute chat notifications'})).toBeVisible();
 await page.evaluate(()=>{window.chatData.messages=[{id:'report-me',user_id:'u2',username:'Rival',body:'Report sample',created_at:new Date().toISOString(),equipped:{}}];return EarnlyChat.refresh();});
 await page.getByLabel('Actions for message by Rival').click();await page.getByLabel('Report reason').selectOption('harassment');await page.getByRole('button',{name:'Report message'}).click();await expect(page.locator('.chat-status')).toContainText('Report saved');await expect(page.locator('.chat-body')).toHaveCount(0);
});
test('chat fits narrow phones, closes accessibly and is absent during gameplay',async({page})=>{
 await setup(page);await page.screenshot({path:'test-results/chat-'+test.info().project.name+'.png'});for(const width of [320,390,440]){await page.setViewportSize({width,height:650});const box=await page.locator('#arcadeChat').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(box.y+box.height).toBeLessThanOrEqual(650);expect(await page.locator('#arcadeChat').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBeTruthy();}
 await page.getByRole('button',{name:'Close chat',exact:true}).click();await expect(page.locator('#arcadeChat')).not.toBeVisible();await expect(page.locator('#arcadeChatButton')).toBeFocused();
 await page.goto('/crystal-command.html');await expect(page.locator('#arcadeChatButton')).toHaveCount(0);
});
test('sign out clears messages and draft; unread badge stops when muted',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Close chat',exact:true}).click();await page.evaluate(()=>{window.chatData.messages.push({id:'new',user_id:'u2',username:'Rival',body:'New message',created_at:new Date(Date.now()+1000).toISOString(),equipped:{}});return EarnlyChat.refresh();});await expect(page.locator('.arcade-chat-badge')).toBeVisible();
 await page.locator('#arcadeChatButton').click();await expect(page.locator('.arcade-chat-badge')).toBeHidden();await page.locator('#chatMessage').fill('private unfinished draft');await page.evaluate(()=>{window.chatUser=null;window.dispatchEvent(new Event('earnly-cloud-auth-change'));});await expect(page.locator('.chat-body')).toHaveCount(0);await expect(page.locator('#chatMessage')).toHaveValue('');await expect(page.getByRole('link',{name:'Sign in / Create account'})).toBeVisible();
});
