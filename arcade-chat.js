(() => {
 'use strict';
 if (window.EarnlyChat) return;
 const pages=new Set(['index.html','games.html','profile.html','avatars.html','rewards.html','stats.html','leaderboards.html','account.html','settings.html','support.html']);
 if(!pages.has(location.pathname.split('/').pop()||'index.html'))return;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn,cls='')=>{const n=el('button',cls,text);n.type='button';n.onclick=fn;return n;};
 const link=(text,href)=>{const n=el('a','',text);n.href=href;return n;};
 const read=k=>{try{return localStorage.getItem(k)}catch{return null}};
 const save=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
 const launcher=button('💬 Chat',()=>open(),'arcade-chat-launcher');launcher.id='arcadeChatButton';launcher.setAttribute('aria-haspopup','dialog');
 const badge=el('span','arcade-chat-badge');badge.hidden=true;launcher.append(badge);
 const dialog=el('dialog','arcade-chat');dialog.id='arcadeChat';dialog.setAttribute('aria-labelledby','chatTitle');
 const header=el('header','chat-header'),heading=el('div');const title=el('h2','','Arcade Chat');title.id='chatTitle';
 heading.append(el('span','chat-eyebrow','THE PLAYER LOUNGE'),title);
 const close=button('×',()=>dialog.close(),'chat-close');close.setAttribute('aria-label','Close chat');header.append(heading,close);
 const subtitle=el('p','chat-subtitle','Meet players. Talk games. Find your next rival.');
 const status=el('p','chat-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const gate=el('section','chat-gate');
 const list=el('div','chat-messages');list.setAttribute('role','region');list.setAttribute('aria-label','Recent chat messages');list.tabIndex=0;
 const jump=button('New messages ↓',()=>{list.scrollTop=list.scrollHeight;markRead();jump.hidden=true},'chat-jump');jump.hidden=true;
 const settings=el('details','chat-settings'),summary=el('summary','','Chat settings & safety');settings.append(summary);
 const settingsContent=el('div','chat-settings-content');settings.append(settingsContent);
 const form=el('form','chat-compose'),input=el('textarea');input.id='chatMessage';input.rows=2;input.maxLength=280;input.placeholder='Say hello to the arcade…';input.setAttribute('aria-label','Message');
 const send=el('button','chat-send','Send');send.type='submit';
 const counter=el('span','chat-counter','0 / 280');const composeRow=el('div','chat-compose-row');composeRow.append(counter,send);form.append(input,composeRow);
 const footer=el('p','chat-footer');footer.append(document.createTextNode('Public to signed-in players · No links or personal details. '),link('Support','support.html'));
 dialog.append(header,subtitle,status,gate,list,jump,settings,form,footer);document.body.append(launcher,dialog);
 let uid=null,epoch=0,timer=null,loading=false,busy=false,data=null,signature='',pending=null,lastSeen='',forceScroll=true;
 const key=()=>`earnlyChatSeen:${uid}`;
 const isBottom=()=>list.scrollHeight-list.scrollTop-list.clientHeight<65;
 function markRead(){if(!uid||!data?.messages?.length)return;lastSeen=data.messages.at(-1).created_at;save(key(),lastSeen);badge.hidden=true;launcher.setAttribute('aria-label','Open Arcade Chat');}
 function unread(){const count=data?.muted?0:(data?.messages||[]).filter(m=>m.user_id!==uid&&Date.parse(m.created_at)>Date.parse(lastSeen)).length;badge.textContent=count>59?'60+':String(count);badge.hidden=!count;launcher.setAttribute('aria-label',count?`Open Arcade Chat, ${count} unread messages`:'Open Arcade Chat');}
 async function rpc(action,payload={}){const client=window.EarnlyCloud?.client;if(!client)throw new Error('Chat could not connect. Please refresh and try again.');let timeout;try{const r=await Promise.race([client.rpc('arcade_chat',{p_action:action,p_data:payload}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Connection timed out. Please try again.')),15000);})]);if(r.error)throw new Error(r.error.message||'Chat is unavailable. Please try again.');return r.data;}finally{clearTimeout(timeout);}}
 function schedule(){clearTimeout(timer);if(!uid||document.hidden||(!dialog.open&&data?.muted))return;timer=setTimeout(refresh,dialog.open?8000:45000);}
 function paintGate(){gate.replaceChildren();form.hidden=!uid||!data?.accepted||!data?.username;settings.hidden=!uid||!data;list.hidden=!uid||!data;
  if(!uid){gate.append(el('h3','','Your arcade crew is here'),el('p','','Sign in to read the room and join the conversation.'),link('Sign in / Create account','account.html'));return;}
  if(!data){gate.append(el('p','','Connecting to the lounge…'),button('Try again',refresh));return;}
  if(!data.accepted){gate.append(el('h3','','Keep the arcade welcoming'),el('p','','Be kind. No harassment, hate, sexual content, scams, spam, or personal information. Messages are visible to signed-in players. Report problems using the menu beside a message.'),link('Community terms','terms.html#arcade-chat-rules'),button('I agree — join chat',()=>action('accept')));}
  else if(!data.username)gate.append(el('p','','Choose your public username before sending your first message.'),link('Choose a username','profile.html'));
 }
 function avatar(equipped){const n=el('span','chat-avatar');n.setAttribute('aria-hidden','true');const parts=window.EarnlyPotatoRig?.compose(equipped)||[];
  for(const p of parts){if(!/^cosmetic-[a-z0-9-]+\.svg$/.test(p.imageUrl||''))continue;const i=el('img');i.src=p.imageUrl;i.alt='';i.loading='lazy';n.append(i);}
  if(!n.children.length){const i=el('img');i.src='cosmetic-russet-potato.svg';i.alt='';n.append(i);}return n;}
 function paintMessages(){const next=JSON.stringify(data.messages||[]);if(next===signature&&!forceScroll)return;const stick=forceScroll||isBottom(),old=list.scrollTop;signature=next;
  list.replaceChildren();if(!data.messages?.length)list.append(el('p','chat-empty','The lounge is quiet. Be the first to say hello!'));
  for(const m of data.messages||[]){const row=el('article','chat-message'+(m.user_id===uid?' chat-own':''));row.dataset.messageId=m.id;
   const content=el('div','chat-message-content'),meta=el('div','chat-message-meta');meta.append(el('strong','','@'+m.username));const t=el('time');t.dateTime=m.created_at;t.textContent=new Date(m.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});meta.append(t);
   const menu=el('details','chat-message-menu'),ms=el('summary','','•••');ms.setAttribute('aria-label','Actions for message by '+m.username);menu.append(ms);const choices=el('div','chat-message-actions');
   if(m.user_id===uid)choices.append(button('Delete message',()=>action('delete',{message_id:m.id})));
   else {choices.append(button('Block @'+m.username,()=>action('block',{user_id:m.user_id},'Player blocked. You will no longer see each other’s messages.')));
    const reason=el('select');reason.setAttribute('aria-label','Report reason');for(const [v,label] of [['spam','Spam / scam'],['harassment','Harassment / hate'],['unsafe','Unsafe content'],['other','Other concern']]){const o=el('option','',label);o.value=v;reason.append(o);}choices.append(reason,button('Report message',()=>action('report',{message_id:m.id,reason:reason.value},'Report saved for review. This message is hidden from you.')));}
   menu.append(choices);meta.append(menu);content.append(meta,el('p','chat-body',m.body));row.append(avatar(m.equipped),content);list.append(row);
  }
  if(stick){list.scrollTop=list.scrollHeight;if(dialog.open)markRead();jump.hidden=true;}else {list.scrollTop=old;jump.hidden=!dialog.open;}
  forceScroll=false;
 }
 function paintSettings(){settingsContent.replaceChildren();const mute=button(data.muted?'Unmute chat notifications':'Mute chat notifications',()=>action('mute',{muted:!data.muted}));mute.setAttribute('aria-pressed',String(data.muted));settingsContent.append(mute,el('p','','Muting turns off unread badges. Blocking hides messages in both directions.'));
  if(data.blocked?.length){settingsContent.append(el('h3','','Blocked players'));for(const b of data.blocked)settingsContent.append(button('Unblock @'+b.username,()=>action('unblock',{user_id:b.user_id})));}
  settingsContent.append(link('Rules & moderation','terms.html#arcade-chat-rules'));}
 async function refresh(){if(!uid||loading||document.hidden){schedule();return;}const stamp=epoch;loading=true;
  try{const next=await rpc('feed');if(stamp!==epoch)return;data=next;status.textContent='';paintGate();paintSettings();unread();if(dialog.open)paintMessages();}
  catch(e){if(stamp===epoch){status.textContent=navigator.onLine===false?'You’re offline. Your unsent message stays here.':e.message;}}
  finally{if(stamp===epoch){loading=false;schedule();}}
 }
 async function action(name,args={},success=''){if(busy)return;let stamp=epoch;busy=true;send.disabled=true;
  try{await rpc(name,args);if(stamp!==epoch)return;stamp=++epoch;loading=false;await refresh();if(stamp===epoch)status.textContent=success;}
  catch(e){if(stamp===epoch)status.textContent=e.message;}
  finally{if(stamp===epoch){busy=false;send.disabled=false;}}
 }
 async function syncAuth(){const stamp=++epoch;clearTimeout(timer);uid=null;data=null;signature='';pending=null;loading=false;busy=false;input.value='';input.readOnly=false;counter.textContent='0 / 280';send.disabled=false;list.replaceChildren();status.textContent='';badge.hidden=true;paintGate();
  try{const session=await window.EarnlyCloud?.session();if(stamp!==epoch)return;uid=session?.user?.id||null;lastSeen=read(key())||new Date().toISOString();if(uid)save(key(),lastSeen);paintGate();if(uid)await refresh();}catch(e){if(stamp===epoch)status.textContent=e.message;}}
 function fitViewport(){const v=window.visualViewport;const height=v?.height||innerHeight;dialog.style.height=Math.min(720,height-28)+'px';dialog.style.maxHeight=(height-28)+'px';dialog.style.top=((v?.offsetTop||0)+Math.max(14,(height-Math.min(720,height-28))/2))+'px';dialog.classList.toggle('chat-short',height<500);}
 function open(){forceScroll=true;fitViewport();dialog.showModal();paintGate();if(data){paintMessages();markRead();}refresh();}
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!uid||!input.value.trim())return;let stamp=epoch;const body=input.value.trim();if(!pending||pending.body!==body)pending={body,request_id:crypto.randomUUID()};busy=true;send.disabled=true;input.readOnly=true;status.textContent='Sending…';
  try{await rpc('send',pending);if(stamp!==epoch)return;input.value='';pending=null;counter.textContent='0 / 280';forceScroll=true;stamp=++epoch;loading=false;await refresh();if(stamp===epoch)status.textContent='Message sent.';}
  catch(e){if(stamp===epoch)status.textContent=e.message;}
  finally{if(stamp===epoch){busy=false;send.disabled=false;input.readOnly=false;}}
 });
 input.addEventListener('input',()=>{counter.textContent=`${input.value.length} / 280`;});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}});
 list.addEventListener('scroll',()=>{if(dialog.open&&isBottom()){markRead();jump.hidden=true;}});
 dialog.addEventListener('close',()=>{schedule();launcher.focus();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else refresh();});window.addEventListener('online',refresh);
 window.addEventListener('earnly-cloud-auth-change',syncAuth);window.addEventListener('earnly-cloud-ready',()=>{if(!uid)syncAuth();});
 window.visualViewport?.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('scroll',fitViewport);window.addEventListener('resize',fitViewport);
 window.EarnlyChat={open,refresh};syncAuth();
})();
