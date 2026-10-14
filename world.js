(()=>{'use strict';
 const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 let socket=null,connected=false,connecting=false,session=null,userId='preview',scene=null,bootstrap={catalog:[],items:[],rooms:[],friends:[]},placing=null,rotation=0,chat=[],trade=null,currentPanel='',privateTarget=null,toastTimer;
 const pending=new Map();
 const demoCatalog=[['mint-sofa','Mint Cloud Sofa','sofa',180,'#59dcc5',2,1],['rose-sofa','Rose Cloud Sofa','sofa',180,'#f599bd',2,1],['arcade-chair','Arcade Chair','chair',60,'#799ff5',1,1],['low-table','Orbit Table','table',80,'#e1b786',1,1],['fern','Moon Fern','plant',70,'#64c786',1,1],['neon-lamp','Neon Tube Lamp','lamp',90,'#c293f3',1,1],['arcade-cabinet','Pocket Arcade Cabinet','arcade',450,'#f6c35e',1,1],['cloud-bed','Cloud Bed','bed',250,'#8cbbf4',1,2],['mint-rug','Mint Tile Rug','rug',40,'#61bfbb',2,2],['star-trophy','First Light Trophy','trophy',600,'#f8d46a',1,1]].map(([id,name,sprite_id,price,color,width,length])=>({id,name,sprite_id,price,color,width,length,category:sprite_id==='arcade'?'Arcade':sprite_id==='trophy'?'Collectors':'Neon Living',supply_limit:sprite_id==='trophy'?250:null,minted:0}));
 function toast(text){$('worldToast').textContent=text;$('worldToast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('worldToast').hidden=true,4200);}
 function button(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){toast(e.message||'Try again.');}finally{b.disabled=false;}};return b;}
 function row(label,buttons=[]){const r=el('div','panel-row');r.append(el('strong','',label),...buttons);return r;}
 function note(text){return el('p','muted',text);}
 function openPanel(title){$('panelTitle').textContent=title;$('panelContent').replaceChildren();if(!$('worldPanel').open)$('worldPanel').showModal();return $('panelContent');}
 function requireConnection(){if(!connected)throw new Error('This is a room preview. Multiplayer is not connected yet.');}
 function action(action,data={}){requireConnection();return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Connection timed out. Refresh before retrying a purchase.'));},10000);pending.set(requestId,{resolve,reject,timer});socket.send(JSON.stringify({type:'ACTION',requestId,action,data}));});}
 async function refresh(){bootstrap=await action('bootstrap');$('coinBalance').textContent='◇ '+BigInt(bootstrap.balance||0).toLocaleString();}
 const renderer=new EarnlyWorldRenderer.WorldRenderer($('worldCanvas'),async hit=>{
  if(hit.staff){try{await showStaff(hit.staff);}catch(e){toast(e.message);}return;}
  if(hit.user){showPlayer(hit.user);return;}if(!scene)return;
  if(hit.item&&!connected){toast('Connect to World, then enter your own room to move furniture.');return;}
  if(hit.item&&!placing&&connected){if(hit.doubleTap&&scene.ownerId===userId)beginPlacement(hit.item,hit.item.name,true);else showDecor(hit.item);return;}
  const rows=scene.heightmap.split('\n');if(hit.x<0||hit.y<0||hit.y>=rows.length||hit.x>=rows[0].length||rows[hit.y][hit.x]==='x')return;
  if(placing){try{await action('place',{itemId:placing.id,x:hit.x,y:hit.y,rotation});placing=null;showPlacement();await refresh();toast('Placed in your room');}catch(e){toast(e.message);}return;}
  if(connected){const item=(scene.items||[]).find(i=>{const rotated=i.rotation===2||i.rotation===6;return hit.x>=i.x&&hit.y>=i.y&&hit.x<i.x+(rotated?i.length:i.width)&&hit.y<i.y+(rotated?i.width:i.length);});socket.send(JSON.stringify(item&&(item.canSit||item.canLay)?{type:'INTERACT',x:hit.x,y:hit.y,action:item.canLay?'lay':'sit'}:{type:'MOVE_TO',x:hit.x,y:hit.y}));}else renderer.updateUser({userId,username:'You',position:{x:hit.x,y:hit.y,z:0}});
 });
 function setScene(value){if(scene?.roomId!==value.roomId){placing=null;showPlacement();}scene=value;renderer.setScene(value);$('roomName').textContent=value.name||'Earnly Plaza';$('roomKind').textContent=value.ownerId?'YOUR PERSONAL SPACE':'PUBLIC HANGOUT';$('stageTip').textContent=connected&&value.ownerId===userId?'Double-tap furniture to move · Drag to look around':'Tap seats to sit · Tap the floor to walk';}
 function beginPlacement(item,name,gesture=false){requireConnection();if(scene.ownerId!==userId)throw new Error('Enter your own room to decorate.');renderer.clearPlacement();placing={...item,name};rotation=scene.items.find(i=>i.id===item.id)?.rotation??0;if(gesture){renderer.selected=null;renderer.placement={item:{...item},x:item.x,y:item.y,rotation};renderer.lastTap=null;}showPlacement();$('worldPanel').close();}
 function showDecor(item){
  if(!connected)return;
  currentPanel='decor';const root=openPanel(item.name||'Room decor');
  if(item.canSit||item.canLay)root.append(button(item.canLay?'Lie down':'Sit',()=>{const rotated=item.rotation===2||item.rotation===6,w=rotated?item.length:item.width,h=rotated?item.width:item.length;const occupied=new Set([...renderer.users.values(),...renderer.staff.values()].map(u=>u.position.x+','+u.position.y));const seats=[];for(let y=item.y;y<item.y+h;y++)for(let x=item.x;x<item.x+w;x++)if(!occupied.has(x+','+y))seats.push({x,y});if(!seats.length)throw new Error('This seat is occupied. Choose another seat.');const me=renderer.users.get(userId)?.position||item;seats.sort((a,b)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y));socket.send(JSON.stringify({type:'INTERACT',...seats[0],action:item.canLay?'lay':'sit'}));$('worldPanel').close();toast('Walking to '+item.name+' · Tap clear floor to stand up');},'primary'));
  else root.append(note('This furniture cannot be sat on.'));
  if(scene.ownerId===userId)root.append(button('Move',()=>beginPlacement(item,item.name),'primary'),button('Rotate ↻',async()=>{await action('place',{itemId:item.id,x:item.x,y:item.y,rotation:(item.rotation+2)%8});await refresh();$('worldPanel').close();toast('Furniture rotated');}),button('Return to Backpack',async()=>{await action('place',{itemId:item.id,pickup:true});await refresh();$('worldPanel').close();toast('Returned to your Backpack');}));
 }
 function showPlacement(){ if(!placing)renderer.clearPlacement();$('placementInstructions').textContent=renderer.placement?'Slide to move · Double-tap to drop':'Tap a floor tile to place';$('placementHint').hidden=!placing;$('stageTip').hidden=!!placing;$('placingName').textContent=placing?.name||'';}
 $('rotateItem').onclick=()=>{if(renderer.placement?.saving)return;rotation=(rotation+2)%8;if(renderer.placement)renderer.placement.rotation=rotation;toast('Rotated '+(rotation*45)+'°');};$('cancelPlace').onclick=()=>{if(renderer.placement?.saving)return;placing=null;showPlacement();};
 renderer.canEditItem=item=>connected&&scene?.ownerId===userId&&bootstrap.items.some(i=>i.id===item.id);
 renderer.onPlacementDrop=async()=>{
  const p=renderer.placement;if(!p||p.saving)return;
  const check=renderer.placementResult();if(!check.valid){toast(check.reason||'Cannot place here · Slide to a green tile');return;}
  p.saving=true;$('rotateItem').disabled=true;$('cancelPlace').disabled=true;
  try{await action('place',{itemId:p.item.id,x:p.x,y:p.y,rotation:p.rotation});if(renderer.placement===p){placing=null;showPlacement();await refresh();toast('Placed in your room');}}
  catch(e){toast(e.message);}
  finally{p.saving=false;$('rotateItem').disabled=false;$('cancelPlace').disabled=false;}
 };
 $('zoomIn').onclick=()=>renderer.zoom=Math.min(2.2,renderer.zoom+.2);$('zoomOut').onclick=()=>renderer.zoom=Math.max(.6,renderer.zoom-.2);
 $('closePanel').onclick=()=>$('worldPanel').close();
 $('worldPanel').addEventListener('click',e=>{if(e.target===$('worldPanel')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
 async function preview(){
  bootstrap={catalog:demoCatalog,items:[],friends:[],rooms:[]};
  setScene({name:'Earnly Plaza',heightmap:Array(10).fill('0000000000').join('\n'),ownerId:null,items:[['mint-sofa',1,2],['rose-sofa',6,1],['low-table',4,3],['fern',0,0],['fern',8,0],['neon-lamp',0,5],['arcade-cabinet',8,5],['arcade-chair',3,5],['star-trophy',7,8]].map(([id,x,y])=>{const d=demoCatalog.find(c=>c.id===id);return {...d,definitionId:id,sprite:d.sprite_id,x,y,z:0,rotation:0};})});
  renderer.setUsers([{userId,username:'You',position:{x:5,y:5,z:0}}]);
  $('connectionStatus').textContent='Sign in to join · Explore the room preview';$('worldNote').textContent='Room preview only. Changes are not saved and purchases are disabled.';
  try{session=await window.EarnlyCloud?.session();if(session){const res=await fetch('https://zdwziebtbpuolusztede.supabase.co/functions/v1/avatars/api/me',{headers:{Authorization:'Bearer '+session.access_token}});if(res.ok){const data=await res.json();renderer.updateUser({userId,username:data.user.username||'You',equipped:data.user.equipped,position:{x:5,y:5,z:0}});}}}catch{}
 }
 function finishConnecting(){connecting=false;$('reconnect').disabled=false;$('reconnect').textContent=connected?'Reconnect':'Connect';}
 async function connect(roomId='plaza'){
  if(connecting)return;
  const endpoint=window.EarnlyWorldConfig?.endpoint;
  if(!endpoint){toast('The World preview is ready. The multiplayer server is not live yet.');return;}
  if(!/^wss:\/\//.test(endpoint))throw new Error('Secure World connection required');
  connecting=true;$('reconnect').disabled=true;$('reconnect').textContent='Connecting…';
  try{
  session=await window.EarnlyCloud?.session();if(!session){finishConnecting();openPanel('Join Earnly World').append(note('Sign in to enter the plaza with your saved potato avatar.'),Object.assign(el('a','primary','Sign in'),{href:'account.html'}));return;}
  const token=session.access_token;
  if(socket&&socket.readyState<2){const previous=socket;socket=null;connected=false;placing=null;showPlacement();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Changing rooms. Please retry.'));}pending.clear();await new Promise((resolve,reject)=>{
    let timer;
    const cleanup=()=>{clearTimeout(timer);previous.removeEventListener('message',onMessage);previous.removeEventListener('close',done);};
    const done=()=>{cleanup();previous.close();resolve();};
    const onMessage=e=>{try{if(JSON.parse(e.data).type==='LEFT')done();}catch{}};
    previous.addEventListener('message',onMessage);previous.addEventListener('close',done,{once:true});
    timer=setTimeout(()=>{cleanup();previous.close();reject(new Error('Room switch timed out. Tap Connect to retry.'));},6000);
    if(previous.readyState===WebSocket.OPEN)previous.send(JSON.stringify({type:'LEAVE'}));else previous.close();
   });}connected=false;$('connectionStatus').textContent='Connecting to your room…';
  $('worldNote').textContent='Multiplayer beta · The first connection may take about a minute while the server wakes up.';
  const ws=new WebSocket(endpoint);socket=ws;
  ws.onopen=()=>{if(socket===ws)ws.send(JSON.stringify({type:'JOIN',version:1,token,roomId}));};
  ws.onmessage=e=>{if(socket!==ws)return;let p;try{p=JSON.parse(e.data);}catch{return;}
   if(p.type==='RESULT'){const r=pending.get(p.requestId);if(r){clearTimeout(r.timer);pending.delete(p.requestId);p.error?r.reject(Object.assign(new Error(p.error),{definite:p.definite===true})):r.resolve(p.data);}return;}
   if(p.type==='NPC_SNAPSHOT')renderer.setStaff(p.staff);
   else if(p.type==='ROOM_SNAPSHOT')renderer.setUsers(p.users);
   else if(p.type==='USER_JOINED')renderer.updateUser(p);
   else if(p.type==='USER_LEFT')renderer.users.delete(p.userId);
   else if(p.type==='ROOM_DELTA')p.users.forEach(u=>renderer.updateUser(u));
   else if(p.type==='WELCOME'){connected=true;finishConnecting();userId=p.userId;bootstrap=p.bootstrap;setScene(p.scene);chat=[];$('connectionStatus').textContent='Live · Tap a tile to walk';$('worldNote').textContent='Your saved avatar. Your own rooms. Arcade Coins and decor have no cash value.';$('coinBalance').textContent='◇ '+BigInt(bootstrap.balance||0).toLocaleString();$('worldPanel').close();}
   else if(p.type==='SCENE')setScene(p.scene);
   else if(p.type==='CHAT'){chat.push(p);chat=chat.slice(-80);renderer.bubble(p);if(currentPanel==='chat'&&$('worldPanel').open)showChat();}
   else if(p.type==='PRIVATE'&&p.userId!==userId){toast('New private message from '+p.username);if(privateTarget&&$('worldPanel').open)showPrivate(privateTarget);}
   else if(p.type==='TRADE'){trade=p.trade;if(trade.status==='complete')refresh().catch(()=>{});showTrade();}
   if(connected){$('peopleCount').textContent=renderer.users.size+' in the room';const state=renderer.users.get(userId)?.state;$('connectionStatus').textContent=state==='sit'?'Live · Sitting · Tap clear floor to stand up':state==='lay'?'Live · Lying down · Tap clear floor to stand up':'Live · Tap seats to sit or a floor tile to walk';}
  };
  ws.onclose=e=>{if(socket!==ws)return;connected=false;finishConnecting();placing=null;showPlacement();$('peopleCount').textContent='Room preview';$('worldNote').textContent='Your room is not connected. Enter your own room after connecting to move furniture.';$('connectionStatus').textContent=e.code===1011&&e.reason==='World service configuration'?'World is temporarily unavailable · Server setup needs attention.':e.code===4001?'Your session expired · Sign in again to enter World.':e.code===4003?'Confirm your account email before entering World.':e.code===1013?'Room loading timed out · Tap Connect to retry.':e.code===1008?'Entry unavailable · Sign in again, close other World tabs, then reconnect.':'Disconnected · Reconnect to keep playing';for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Disconnected. Reconnect before retrying.'));}pending.clear();};
  ws.onerror=()=>{if(socket===ws)$('connectionStatus').textContent='Could not connect to World. Please try again.';};
  }catch(error){finishConnecting();throw error;}
 }
 $('reconnect').onclick=()=>connect().catch(e=>toast(e.message));
 function showCatalog(category='All'){
  currentPanel='catalog';const root=openPanel('Decor Catalog');root.append(note(connected?'Find the next piece for your room. Purchases use Arcade Coins.':'Preview our original decor collection. Sign in and connect to buy decor.'));
  const filters=el('div','filters');for(const name of ['All',...new Set(bootstrap.catalog.map(d=>d.category))])filters.append(button(name,()=>showCatalog(name),name===category?'selected':''));root.append(filters);
  const grid=el('div','catalog-grid');for(const d of bootstrap.catalog.filter(d=>category==='All'||d.category===category)){
   const card=el('article','item-card'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,d);card.append(canvas,el('h3','',d.name));
   card.append(el('p','',d.supply_limit?`${Math.max(0,d.supply_limit-d.minted)} of ${d.supply_limit} left`:'Collect · Decorate · Trade'));
   const buy=button('◇ '+Number(d.price).toLocaleString()+' · Buy',()=>showBuy(d));buy.disabled=!connected||d.supply_limit&&d.minted>=d.supply_limit;card.append(buy);grid.append(card);
  }root.append(grid);
 }
 function showBuy(d){const root=openPanel('Add to your Backpack?'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,d);canvas.style='display:block;margin:auto';root.append(canvas,el('h3','',d.name),note('Price: '+d.price+' Arcade Coins. This purchase adds one decor item to your Backpack.'));
  const purchaseKey='earnlyWorldPendingPurchase:'+userId;let saved;try{saved=JSON.parse(localStorage.getItem(purchaseKey)||'null');}catch{}const requestId=saved?.definitionId===d.id?saved.requestId:crypto.randomUUID();root.append(button('Buy for ◇ '+d.price,async()=>{if(saved&&saved.definitionId!==d.id)throw new Error('Reopen your previous item to confirm its purchase first.');localStorage.setItem(purchaseKey,JSON.stringify({definitionId:d.id,requestId}));try{await action('buy',{definitionId:d.id,requestId});}catch(error){if(error.definite)localStorage.removeItem(purchaseKey);throw error;}localStorage.removeItem(purchaseKey);await refresh();toast(d.name+' added to your Backpack');showBackpack();},'primary'),button('Back to catalog',()=>showCatalog()));
 }
 function showBackpack(){currentPanel='backpack';const root=openPanel('Your Backpack');if(!connected){root.append(note('Your purchased and collected decor will be stored here. Sign in and connect to begin your collection.'));return;}
  root.append(note(scene.ownerId===userId?'Choose an item, then tap a tile in your room.':'Enter your own room to arrange your decor.'));
  const grid=el('div','catalog-grid');for(const item of bootstrap.items){const d=bootstrap.catalog.find(d=>d.id===item.definition_id);if(!d)continue;const card=el('article','item-card'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,d);card.append(canvas,el('h3','',d.name),el('p','',`No. ${item.serial} · ${item.room_id?'Placed':'In Backpack'}`));
   const place=button(item.room_id?'Move':'Place',()=>beginPlacement(item,d.name));place.disabled=scene.ownerId!==userId||item.room_id&&item.room_id!==scene.roomId;card.append(place);
   if(item.room_id===scene.roomId)card.append(button('Pick up',async()=>{await action('place',{itemId:item.id,pickup:true});await refresh();showBackpack();}));grid.append(card);
  }root.append(grid);if(!bootstrap.items.length)root.append(note('Your Backpack is empty. Find your first piece in the Catalog.'),button('Open Catalog',()=>showCatalog()));
 }
 function showRooms(){currentPanel='rooms';const root=openPanel('Find your place');if(!connected){root.append(note('The plaza is a shared hangout. Personal rooms will let you decorate, invite friends, and show off your collection.'),button('Connect to World',()=>connect()));return;}
  root.append(note('Public hangouts are furnished and open to everyone. Staff NPCs stay at their posts; public decor stays here.'));
  for(const r of bootstrap.rooms){const card=el('section','room-card');card.append(row(r.name,[button(r.ownerId===userId?'My room →':'Visit →',()=>connect(r.id))]));const descriptions={'Hotel Lobby':'Velvet sofas · Reception with Pip','Rooftop Lounge':'City lights · Mocktail bar with Remy','Patio Hangout':'Garden seating · Patio host Fern','Earnly Plaza':'The original shared meeting spot'};card.append(note(r.ownerId===null?descriptions[r.name]||'Public hangout':r.ownerId===userId?'Your personal room':'Player-owned room'));root.append(card);}
  const form=el('form','panel-form'),input=el('input');input.placeholder='Name your new room';input.maxLength=40;input.required=true;const create=el('button','primary','Create');create.type='submit';form.append(input,create);form.onsubmit=async e=>{e.preventDefault();create.disabled=true;try{const r=await action('create_room',{name:input.value});await connect(r.roomId);}catch(err){toast(err.message);}finally{create.disabled=false;}};root.append(form,note('Up to 3 personal rooms. New rooms start closed to visitors.'));
  if(scene.ownerId===userId)root.append(button(scene.access==='open'?'Close to visitors':'Open to visitors',async()=>{const access=scene.access==='open'?'closed':'open';await action('room_access',{roomId:scene.roomId,access});scene.access=access;await refresh();showRooms();}));
 }
 async function showStaff(staff){const reply=await action('staff_talk',{staffId:staff.staffId});currentPanel='staff';const root=openPanel(reply.name+' · '+reply.role);root.append(note('Staff NPC · Lives and works in this hangout'),el('p','staff-greeting',reply.greeting),button(reply.role==='Bartender'?'See the mocktail menu':'Ask for a tip',()=>{const p=el('p','staff-greeting',reply.tip);root.replaceChildren(note('Staff NPC · '+reply.role),p,button('Explore rooms',()=>showRooms()));}),button('Explore rooms',()=>showRooms()));}
 function showStaffList(){currentPanel='staff';const root=openPanel('Room staff');if(!connected){root.append(note('Connect to World to meet the room staff.'));return;}for(const staff of renderer.staff.values())root.append(row(staff.username+' · '+staff.role,[button('Say hello',()=>showStaff(staff))]));if(!renderer.staff.size)root.append(note('No staff in this room. Visit the Hotel Lobby, Rooftop Lounge or Patio Hangout.'));}
 function showFriends(){currentPanel='friends';const root=openPanel('Friends');if(!connected){root.append(note('Accepted friends will appear here with online status and private messages.'));return;}
  for(const f of bootstrap.friends){const controls=f.accepted?[button('Message',()=>showPrivate(f)),button('Remove',async()=>{await action('friend_remove',{userId:f.userId});await refresh();showFriends();})]:f.incoming?[button('Accept',async()=>{await action('friend_accept',{userId:f.userId});await refresh();showFriends();})]:[];root.append(row(f.username+(f.accepted?(f.online?' · Online':' · Offline'):' · Request'),controls));}
  const form=el('form','panel-form'),input=el('input');input.placeholder='Friend’s username';input.maxLength=18;input.required=true;const submit=el('button','','Add');submit.type='submit';form.append(input,submit);form.onsubmit=async e=>{e.preventDefault();try{await action('friend_request',{username:input.value});await refresh();showFriends();toast('Friend request sent');}catch(err){toast(err.message);}};root.append(form,button('Refresh status',async()=>{await refresh();showFriends();}));
 }
 async function showPrivate(friend){privateTarget=friend;currentPanel='private';const root=openPanel('Message '+friend.username);root.append(note('Loading conversation…'));try{const messages=await action('private_feed',{userId:friend.userId});root.replaceChildren(note('Private messages are for accepted friends. Block and report are always available.'));for(const m of messages)root.append(messageRow({id:m.id,text:m.body,username:m.sender===userId?'You':friend.username,userId:m.sender}));
  const form=el('form','panel-form'),input=el('input');input.placeholder='Private message';input.maxLength=280;input.required=true;const send=el('button','primary','Send');send.type='submit';form.append(input,send);form.onsubmit=async e=>{e.preventDefault();try{await ensureChat();await action('private_send',{userId:friend.userId,text:input.value,requestId:crypto.randomUUID()});await showPrivate(friend);}catch(err){toast(err.message);}};root.append(form,button('Block player',async()=>{await action('block',{userId:friend.userId});await refresh();showFriends();}));}catch(e){root.replaceChildren(note(e.message));}}
 function messageRow(m){const div=el('div','chat-message');div.append(el('strong','',(m.username||'Player')+': '),document.createTextNode(m.text));if(m.userId!==userId&&m.id)div.append(button('Report',()=>showReport(m)));return div;}
 function showReport(m){const root=openPanel('Report message');root.append(note(m.text));for(const reason of ['spam','harassment','unsafe','other'])root.append(button(reason,async()=>{await action('report',{messageId:m.id,reason});toast('Report saved for moderator review');$('worldPanel').close();}));}
 function showChat(){currentPanel='chat';const root=openPanel('Room chat');root.append(note('Be kind. Don’t share personal details. No harassment, scams, external sales, or wagering. Tap a player to block them.'));for(const m of chat)root.append(messageRow(m));if(!chat.length)root.append(note('Room messages will appear here.'));
  if(connected&&!bootstrap.chatAccepted)root.append(button('I agree to the chat rules',async()=>{await action('accept_chat');bootstrap.chatAccepted=true;toast('Chat is ready');showChat();},'primary'));
 }
 async function ensureChat(){requireConnection();if(!bootstrap.chatAccepted){showChat();throw new Error('Please agree to the chat rules first.');}}
 $('sayForm').onsubmit=async e=>{e.preventDefault();try{await ensureChat();const text=$('sayText').value.trim();if(!text)return;await action('say',{text,mode:'normal',requestId:crypto.randomUUID()});$('sayText').value='';}catch(err){toast(err.message);}};
 function showPlayer(player){currentPanel='player';const root=openPanel(player.username||'Your potato');const art=el('div','avatar-preview');for(const item of window.EarnlyPotatoRig.compose(player.equipped||{avatar:{imageUrl:'cosmetic-cyber-starter.svg'}})){if(!/^cosmetic-[a-z0-9-]+\.svg$/.test(item.imageUrl))continue;const img=el('img');img.src=item.imageUrl;img.alt=item.name||'';art.append(img);}root.append(art);
  if(player.userId===userId){const link=el('a','primary','Customize your potato →');link.href='avatars.html';root.append(link);return;}if(!connected)return;
  root.append(button('Add friend',async()=>{await action('friend_request',{username:player.username});toast('Friend request sent');}),button('Trade decor',async()=>{trade=await action('trade_create',{userId:player.userId});showTrade();}),button('Whisper',()=>{const form=el('form','panel-form'),input=el('input');input.maxLength=280;input.placeholder='Whisper (stand beside them)';const send=el('button','','Send');form.append(input,send);form.onsubmit=async e=>{e.preventDefault();try{await ensureChat();await action('say',{text:input.value,mode:'whisper',userId:player.userId,requestId:crypto.randomUUID()});$('worldPanel').close();}catch(err){toast(err.message);}};root.append(form);}),button('Block player',async()=>{await action('block',{userId:player.userId});toast('Player blocked');$('worldPanel').close();}));
 }
 function showTrade(){currentPanel='trade';const root=openPanel('Trade decor');if(!trade)return;const complete=trade.status==='complete';root.append(note(complete?'Trade complete. Both collections have been updated.':'Both players lock their offers, then both confirm. Any edit clears both approvals.'));
  if(complete){root.append(button('Open Backpack',async()=>{await refresh();showBackpack();}));return;}
  if(trade.status==='cancelled'){root.append(note('This trade was cancelled.'));return;}
  const matrix=el('div','trade-offers'),mine=el('div'),theirs=el('div');mine.append(el('h3','','You offer'));theirs.append(el('h3','','They offer'));const selected=new Set((trade.offers||[]).filter(o=>o.userId===userId).map(o=>o.itemId));
  for(const i of bootstrap.items.filter(i=>!i.room_id&&i.origin!=='starter')){const d=bootstrap.catalog.find(d=>d.id===i.definition_id);if(!d?.tradeable)continue;const label=el('label'),check=el('input');check.type='checkbox';check.value=i.id;check.checked=selected.has(i.id);check.onchange=async()=>{check.checked?selected.add(i.id):selected.delete(i.id);root.inert=true;try{await perform('edit');}catch(error){toast(error.message);try{trade=await action('trade_read',{tradeId:trade.id});showTrade();}catch{$('worldPanel').close();}}finally{root.inert=false;}};label.append(check,document.createTextNode(d.name+' #'+i.serial));mine.append(label);}
  for(const o of (trade.offers||[]).filter(o=>o.userId!==userId))theirs.append(note(o.name||o.itemId));matrix.append(mine,theirs);root.append(matrix);
  const perform=async command=>{trade=await action('trade_action',{tradeId:trade.id,revision:trade.revision,action:command,items:command==='edit'?[...selected]:[]});showTrade();};
  const isA=(trade.player_a||trade.playerA)===userId,myLock=isA?trade.locked_a:trade.locked_b,myConfirmation=isA?trade.confirmed_a:trade.confirmed_b;const lock=button('Lock my offer',()=>perform('lock')),confirm=button(myConfirmation?'Waiting for partner':'Confirm exchange',()=>perform('confirm'),'primary');lock.disabled=!!myLock;confirm.disabled=!trade.locked_a||!trade.locked_b||!!myConfirmation;root.append(lock,confirm,button('Cancel trade',()=>perform('cancel')));
  root.append(note(`Your lock: ${(trade.player_a||trade.playerA)===userId?!!trade.locked_a:!!trade.locked_b} · Partner lock: ${(trade.player_a||trade.playerA)===userId?!!trade.locked_b:!!trade.locked_a}`));
 }
 const panels={staff:showStaffList,rooms:showRooms,catalog:showCatalog,backpack:showBackpack,friends:showFriends,chat:showChat};document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>panels[b.dataset.panel]());
 $('worldCanvas').onkeydown=e=>{const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(!moves[e.key])return;e.preventDefault();const u=renderer.users.get(userId);if(!u)return;const [x,y]=moves[e.key];if(connected)socket.send(JSON.stringify({type:'MOVE_TO',x:u.position.x+x,y:u.position.y+y}));};
 window.addEventListener('earnly-cloud-auth-change',()=>{if(socket)socket.close();connected=false;session=null;placing=null;showPlacement();});
 preview().then(()=>{if(window.EarnlyWorldConfig?.endpoint)connect().catch(e=>toast(e.message));});
})();
