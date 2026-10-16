(()=>{'use strict';
 const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 let socket=null,connected=false,connecting=false,session=null,userId='preview',scene=null,bootstrap={catalog:[],items:[],rooms:[],friends:[]},placing=null,rotation=0,chat=[],trade=null,currentPanel='',privateTarget=null,toastTimer,needsFirstRoom=false;
 const pending=new Map();
 let connectTimer,retryTimer,retryCount=0,entryTarget='choose-home';
 function entryState(message){
  $('worldEntry').hidden=connected;$('worldConnected').hidden=!connected;$('reconnect').hidden=!connected;
  $('connectWorld').disabled=connecting;$('connectWorld').textContent=connecting?'Connecting…':'Connect to World';
  if(message)$('entryStatus').textContent=message;
  if(connected)requestAnimationFrame(()=>renderer.resize());
 }
 function retryEntry(roomId){
  if(retryCount>=2||navigator.onLine===false)return false;
  const delay=1500*(++retryCount);
  entryState('Reconnecting to your room… ('+retryCount+'/2)');
  clearTimeout(retryTimer);retryTimer=setTimeout(()=>connect(roomId,true).catch(e=>entryState(e.message)),delay);return true;
 }
 const demoCatalog=[['mint-sofa','Mint Cloud Sofa','sofa',180,'#59dcc5',2,1],['rose-sofa','Rose Cloud Sofa','sofa',180,'#f599bd',2,1],['arcade-chair','Arcade Chair','chair',60,'#799ff5',1,1],['low-table','Orbit Table','table',80,'#e1b786',1,1],['fern','Moon Fern','plant',70,'#64c786',1,1],['neon-lamp','Neon Tube Lamp','lamp',90,'#c293f3',1,1],['arcade-cabinet','Pocket Arcade Cabinet','arcade',450,'#f6c35e',1,1],['cloud-bed','Cloud Bed','bed',250,'#8cbbf4',1,2],['mint-rug','Mint Tile Rug','rug',40,'#61bfbb',2,2],['star-trophy','First Light Trophy','trophy',600,'#f8d46a',1,1],["palm-tree", "Sunset Palm", "palm", 140, "#65be86", 1, 1, "Garden"],["ficus-tree", "Cloud Ficus", "tree", 125, "#71bc80", 1, 1, "Garden"],["blossom-tree", "Blossom Tree", "tree", 160, "#eea2c2", 1, 1, "Garden"],["flower-pot", "Starlight Flowers", "flowers", 55, "#eab2ed", 1, 1, "Garden"],["oak-bookshelf", "Oak Bookshelf", "bookshelf", 150, "#b88c66", 1, 1, "Essentials"],["reef-aquarium", "Pocket Reef Aquarium", "aquarium", 220, "#67cbd7", 1, 1, "Neon Living"],["sunset-sofa", "Sunset Sofa", "sofa", 180, "#e6a26f", 2, 1, "Neon Living"],["sage-chair", "Sage Garden Chair", "chair", 60, "#91bb96", 1, 1, "Garden"],["garden-parasol", "Garden Parasol Table", "umbrella", 160, "#edbd85", 1, 1, "Garden"],["amber-lantern", "Amber Lantern", "lamp", 90, "#edc582", 1, 1, "Garden"],["lavender-rug", "Lavender Tile Rug", "rug", 40, "#ac93c8", 2, 2, "Neon Living"],["walnut-table", "Walnut Coffee Table", "table", 80, "#aa8069", 1, 1, "Essentials"],["heirloom-clock", "Heirloom Clock", "clock", 220, "#ae8058", 1, 1, "Heritage"],["retro-tv", "Retro TV Cabinet", "television", 190, "#ac8059", 1, 1, "Heritage"],["courtyard-fountain", "Courtyard Fountain", "fountain", 210, "#adc4bd", 1, 1, "Garden"],["woven-divider", "Woven Room Divider", "divider", 120, "#b89b69", 2, 1, "Heritage"],["marble-column", "Marble Column", "column", 100, "#e3d8bc", 1, 1, "Heritage"],["ruby-sofa", "Ruby Velvet Sofa", "sofa", 200, "#b8586b", 2, 1, "Heritage"]].map(([id,name,sprite_id,price,color,width,length,category])=>({id,name,sprite_id,price,color,width,length,category:category||(sprite_id==='plant'?'Garden':sprite_id==='arcade'?'Arcade':sprite_id==='trophy'?'Collectors':'Neon Living'),supply_limit:sprite_id==='trophy'?250:null,minted:0}));
 function toast(text){$('worldToast').textContent=text;$('worldToast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('worldToast').hidden=true,4200);}
 function button(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){toast(e.message||'Try again.');}finally{b.disabled=false;}};return b;}
 function row(label,buttons=[]){const r=el('div','panel-row');r.append(el('strong','',label),...buttons);return r;}
 function note(text){return el('p','muted',text);}
 function openPanel(title){$('panelTitle').textContent=title;$('panelContent').replaceChildren();if(!$('worldPanel').open)$('worldPanel').showModal();return $('panelContent');}
 function requireConnection(){if(!connected)throw new Error('Connect to World to enter your room first.');}
 function action(action,data={}){requireConnection();return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Connection timed out. Refresh before retrying a purchase.'));},10000);pending.set(requestId,{resolve,reject,timer});socket.send(JSON.stringify({type:'ACTION',requestId,action,data}));});}
 async function refresh(){bootstrap=await action('bootstrap');$('coinBalance').textContent='◇ '+BigInt(bootstrap.balance||0).toLocaleString();}
 const renderer=new EarnlyWorldRenderer.WorldRenderer($('worldCanvas'),async hit=>{
  if(hit.door){showRooms();return;}
  if(hit.staff){try{await showStaff(hit.staff);}catch(e){toast(e.message);}return;}
  if(hit.user){showPlayer(hit.user);return;}if(!scene)return;
  if(hit.item&&!connected){toast('Connect to World, then enter your own room to move furniture.');return;}
  if(hit.item&&!placing&&connected){if(hit.doubleTap&&scene.ownerId===userId)beginPlacement(hit.item,hit.item.name,true);else if(hit.item.canSit||hit.item.canLay){try{useSeat(hit.item);}catch(e){toast(e.message);}}else showDecor(hit.item);return;}
  const rows=scene.heightmap.split('\n');if(hit.x<0||hit.y<0||hit.y>=rows.length||hit.x>=rows[0].length||rows[hit.y][hit.x]==='x')return;
  if(placing){try{await action('place',{itemId:placing.id,x:hit.x,y:hit.y,rotation});placing=null;showPlacement();await refresh();toast('Placed in your room');}catch(e){toast(e.message);}return;}
  if(connected){const item=(scene.items||[]).find(i=>{const rotated=i.rotation===2||i.rotation===6;return hit.x>=i.x&&hit.y>=i.y&&hit.x<i.x+(rotated?i.length:i.width)&&hit.y<i.y+(rotated?i.width:i.length);});socket.send(JSON.stringify(item&&(item.canSit||item.canLay)?{type:'INTERACT',x:hit.x,y:hit.y,action:item.canLay?'lay':'sit'}:{type:'MOVE_TO',x:hit.x,y:hit.y}));}else renderer.updateUser({userId,username:'You',position:{x:hit.x,y:hit.y,z:0}});
 });
 function setScene(value){if(scene?.roomId!==value.roomId){placing=null;showPlacement();}scene=value;renderer.setScene(value);updateViewButtons();$('roomName').textContent=value.name||'Earnly Plaza';$('roomKind').textContent=value.ownerId?'YOUR PERSONAL SPACE':'PUBLIC HANGOUT';$('stageTip').textContent=connected&&value.ownerId===userId?'Double-tap furniture to move · Drag to pan · Pinch to zoom':'Tap seats to sit · Pinch to zoom';}
 function beginPlacement(item,name,gesture=false){requireConnection();if(scene.ownerId!==userId)throw new Error('Enter your own room to decorate.');renderer.clearPlacement();placing={...item,name};rotation=scene.items.find(i=>i.id===item.id)?.rotation??0;if(gesture){renderer.selected=null;renderer.placement={item:{...item},x:item.x,y:item.y,rotation};renderer.lastTap=null;}showPlacement();$('worldPanel').close();}
 function useSeat(item){const rotated=item.rotation===2||item.rotation===6,w=rotated?item.length:item.width,h=rotated?item.width:item.length;const occupied=new Set([...renderer.users.values(),...renderer.staff.values()].map(u=>u.position.x+','+u.position.y));const seats=[];for(let y=item.y;y<item.y+h;y++)for(let x=item.x;x<item.x+w;x++)if(!occupied.has(x+','+y))seats.push({x,y});if(!seats.length)throw new Error('This seat is occupied. Choose another seat.');const me=renderer.users.get(userId)?.position||item;seats.sort((a,b)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y));socket.send(JSON.stringify({type:'INTERACT',...seats[0],action:item.canLay?'lay':'sit'}));$('worldPanel').close();toast('Walking to '+item.name+' · Tap clear floor to stand up');}
 function showDecor(item){
  if(!connected)return;
  currentPanel='decor';const root=openPanel(item.name||'Room decor');
  root.append(note('This furniture cannot be sat on.'));
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
 const updateViewButtons=()=>{$('roomView').setAttribute('aria-pressed',String(renderer.viewMode==='room'));};
 $('zoomIn').onclick=()=>renderer.setZoom(renderer.zoom+.2);$('zoomOut').onclick=()=>renderer.setZoom(renderer.zoom-.2);
 $('roomView').onclick=()=>{renderer.setView(renderer.viewMode==='room'?'close':'room');updateViewButtons();};
 $('focusMe').onclick=()=>{renderer.focusMe();updateViewButtons();};
 $('closePanel').onclick=()=>$('worldPanel').close();
 $('worldPanel').addEventListener('click',e=>{if(e.target===$('worldPanel')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
 function finishConnecting(){clearTimeout(connectTimer);connecting=false;$('reconnect').disabled=false;$('reconnect').textContent=connected?'Reconnect':'Connect';entryState();}
 async function connect(roomId='choose-home',retry=false){
  clearTimeout(retryTimer);if(!retry)retryCount=0;entryTarget=roomId;
  if(connecting)return;
  const endpoint=window.EarnlyWorldConfig?.endpoint;
  if(!endpoint){toast('World is temporarily unavailable. Please try again shortly.');return;}
  if(!/^wss:\/\//.test(endpoint))throw new Error('Secure World connection required');
  connecting=true;entryState('Connecting to your room… The server may need a moment to wake up.');$('worldSignIn').hidden=true;$('reconnect').disabled=true;$('reconnect').textContent='Connecting…';
  try{
  session=await window.EarnlyCloud?.session();if(!session){finishConnecting();$('worldSignIn').hidden=false;entryState('Sign in once to enter your own room and meet other players.');openPanel('Join Earnly World').append(note('Sign in to start in your own room with your saved potato avatar.'),Object.assign(el('a','primary','Sign in'),{href:'account.html'}));return;}
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
  // Allow the free server to wake up, but never leave Connect disabled forever.
  connectTimer=setTimeout(()=>{
   if(socket!==ws||connected)return;
   socket=null;ws.close();finishConnecting();
   $('connectionStatus').textContent='Connection timed out · Tap Connect to retry';
   $('worldNote').textContent='Your saved room and furniture are safe. Check your connection and try again.';if(!retryEntry(roomId))entryState('Connection timed out. Tap Connect to World to try again.');
  },75000);
  ws.onopen=()=>{if(socket===ws)ws.send(JSON.stringify({type:'JOIN',version:1,token,roomId}));};
  ws.onmessage=e=>{if(socket!==ws)return;let p;try{p=JSON.parse(e.data);}catch{return;}
   if(p.type==='RESULT'){const r=pending.get(p.requestId);if(r){clearTimeout(r.timer);pending.delete(p.requestId);p.error?r.reject(Object.assign(new Error(p.error),{definite:p.definite===true})):r.resolve(p.data);}return;}
   if(p.type==='NPC_SNAPSHOT')renderer.setStaff(p.staff);
   else if(p.type==='ROOM_SNAPSHOT')renderer.setUsers(p.users);
   else if(p.type==='USER_JOINED')renderer.updateUser(p);
   else if(p.type==='USER_LEFT')renderer.users.delete(p.userId);
   else if(p.type==='ROOM_DELTA')p.users.forEach(u=>renderer.updateUser(u));
   else if(p.type==='WELCOME'){connected=true;retryCount=0;needsFirstRoom=false;finishConnecting();userId=p.userId;renderer.localUserId=userId;bootstrap=p.bootstrap;setScene(p.scene);chat=[];$('connectionStatus').textContent='Live · Tap a tile to walk';$('worldNote').textContent='Your saved avatar. Your own rooms. Arcade Coins and decor have no cash value.';$('coinBalance').textContent='◇ '+BigInt(bootstrap.balance||0).toLocaleString();$('worldPanel').close();}
   else if(p.type==='SCENE')setScene(p.scene);
   else if(p.type==='CHAT'){chat.push(p);chat=chat.slice(-80);renderer.bubble(p);if(currentPanel==='chat'&&$('worldPanel').open)showChat();}
   else if(p.type==='PRIVATE'&&p.userId!==userId){toast('New private message from '+p.username);if(privateTarget&&$('worldPanel').open)showPrivate(privateTarget);}
   else if(p.type==='TRADE'){trade=p.trade;if(trade.status==='complete')refresh().catch(()=>{});showTrade();}
   if(p.type==='WELCOME'){const category=new URLSearchParams(location.search).get('catalog');if(category)showCatalog(category);}
   if(connected){$('peopleCount').textContent=renderer.users.size+' in the room';const state=renderer.users.get(userId)?.state;$('connectionStatus').textContent=state==='sit'?'Live · Sitting · Tap clear floor to stand up':state==='lay'?'Live · Lying down · Tap clear floor to stand up':'Live · Tap seats to sit or a floor tile to walk';}
  };
  ws.onclose=e=>{if(socket!==ws)return;connected=false;finishConnecting();placing=null;showPlacement();$('peopleCount').textContent='Room preview';$('worldNote').textContent='Your room is not connected. Enter your own room after connecting to move furniture.';if(e.code===4004){needsFirstRoom=true;entryState('Choose your first room — it is free.');$('connectionStatus').textContent='Choose your first room';showRoomCreator(true);return;}$('connectionStatus').textContent=e.code===1011&&e.reason==='World service configuration'?'World is temporarily unavailable · Server setup needs attention.':e.code===4001?'Your session expired · Sign in again to enter World.':e.code===4003?'Confirm your account email before entering World.':e.code===1013?'Room loading timed out · Tap Connect to retry.':e.code===1008?'Entry unavailable · Sign in again, close other World tabs, then reconnect.':'Disconnected · Reconnect to keep playing';entryState($('connectionStatus').textContent);if(e.code===4001||e.code===4003){$('worldSignIn').hidden=false;}if([1006,1012,1013].includes(e.code))retryEntry(roomId);for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Disconnected. Reconnect before retrying.'));}pending.clear();};
  ws.onerror=()=>{if(socket===ws)$('connectionStatus').textContent='Could not connect to World. Please try again.';};
  }catch(error){finishConnecting();entryState(error.message);throw error;}
 }
 $('reconnect').onclick=()=>{if(needsFirstRoom)showRoomCreator(true);else connect().catch(e=>{entryState(e.message);toast(e.message);});};
 $('connectWorld').onclick=$('reconnect').onclick;
 function showCatalog(category='All'){
  currentPanel='catalog';const root=openPanel('Decor Catalog');root.append(note(connected?'Find the next piece for your room. Purchases use Arcade Coins.':'Preview our original decor collection. Sign in and connect to buy decor.'));
  const filters=el('div','filters');for(const name of ['All',...new Set(bootstrap.catalog.map(d=>d.category))])filters.append(button(name,()=>showCatalog(name),name===category?'selected':''));root.append(filters);
  const grid=el('div','catalog-grid');for(const d of bootstrap.catalog.filter(d=>category==='All'||d.category===category)){
   const card=el('article','item-card'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,d);card.append(canvas,el('h3','',d.name));
   const owned=bootstrap.items.filter(i=>i.definition_id===d.id).length;if(owned)card.append(el('p','owned-label',owned+' owned'));
   card.append(el('p','',d.supply_limit?`${Math.max(0,d.supply_limit-d.minted)} of ${d.supply_limit} left`:'Collect · Decorate · Trade'));
   const buy=button('◇ '+Number(d.price).toLocaleString()+' · Buy',()=>showBuy(d));buy.disabled=!connected||d.supply_limit&&d.minted>=d.supply_limit;card.append(buy);grid.append(card);
  }root.append(grid);
 }
 function showBuy(d){const root=openPanel('Add to your Backpack?'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,d);canvas.style='display:block;margin:auto';const preview=el('canvas');preview.className='decor-room-preview';EarnlyWorldRenderer.decorPreview(preview,d);root.append(preview,el('h3','',d.name),note('Price: '+d.price+' Arcade Coins. This purchase adds one decor item to your Backpack.'));
  const purchaseKey='earnlyWorldPendingPurchase:'+userId;let saved;try{saved=JSON.parse(localStorage.getItem(purchaseKey)||'null');}catch{}const requestId=saved?.definitionId===d.id?saved.requestId:crypto.randomUUID();root.append(button('Buy for ◇ '+d.price,async()=>{if(saved&&saved.definitionId!==d.id)throw new Error('Reopen your previous item to confirm its purchase first.');localStorage.setItem(purchaseKey,JSON.stringify({definitionId:d.id,requestId}));try{await action('buy',{definitionId:d.id,requestId});}catch(error){if(error.definite)localStorage.removeItem(purchaseKey);throw error;}localStorage.removeItem(purchaseKey);await refresh();toast(d.name+' added to your Backpack');showBackpack();},'primary'),button('Back to catalog',()=>showCatalog()));
 }
 function showBackpack(){currentPanel='backpack';const root=openPanel('Your Backpack');if(!connected){root.append(note('Your purchased and collected decor will be stored here. Sign in and connect to begin your collection.'));return;}
  root.append(note(scene.ownerId===userId?'Choose an item, then tap a tile in your room.':'Enter your own room to arrange your decor.'));
  const search=el('input');search.type='search';search.placeholder='Find your furniture';search.setAttribute('aria-label','Find your furniture');root.append(search);
  const filter=el('select');filter.setAttribute('aria-label','Furniture location');for(const [value,label] of [['all','All furniture'],['stored','In Backpack'],['here','In this room'],['elsewhere','In another room']]){const option=el('option','',label);option.value=value;filter.append(option);}root.append(filter);
  const grid=el('div','catalog-grid');for(const item of bootstrap.items){const d=bootstrap.catalog.find(d=>d.id===item.definition_id);if(!d)continue;const card=el('article','item-card'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,d);card.append(canvas,el('h3','',d.name),el('p','',`No. ${item.serial} · ${item.room_id?'Placed':'In Backpack'}`));
   card.dataset.name=d.name.toLowerCase();card.dataset.location=!item.room_id?'stored':item.room_id===scene.roomId?'here':'elsewhere';
   const place=button(item.room_id?'Move':'Place',()=>beginPlacement(item,d.name));place.disabled=scene.ownerId!==userId||item.room_id&&item.room_id!==scene.roomId;card.append(place);
   if(item.room_id===scene.roomId)card.append(button('Pick up',async()=>{await action('place',{itemId:item.id,pickup:true});await refresh();showBackpack();}));
   if(item.room_id&&item.room_id!==scene.roomId){const room=bootstrap.rooms.find(r=>r.id===item.room_id);if(room?.ownerId===userId)card.append(button('Visit '+room.name,()=>connect(room.id)));}grid.append(card);
  }root.append(grid);if(!bootstrap.items.length)root.append(note('Your Backpack is empty. Find your first piece in the Catalog.'),button('Open Catalog',()=>showCatalog()));
  const empty=note('No furniture matches. Try another name or location.');empty.hidden=true;root.append(empty);
  const applyFilter=()=>{let count=0;for(const card of grid.children){card.hidden=!card.dataset.name.includes(search.value.trim().toLowerCase())||(filter.value!=='all'&&card.dataset.location!==filter.value);if(!card.hidden)count++;}empty.hidden=count>0||!bootstrap.items.length;};search.oninput=applyFilter;filter.onchange=applyFilter;
 }
 function showRooms(){currentPanel='rooms';const root=openPanel('Find your place');if(needsFirstRoom){showRoomCreator(true);return;}if(!connected){root.append(note('The plaza is a shared hangout. Personal rooms will let you decorate, invite friends, and show off your collection.'),button('Connect to World',()=>connect()));return;}
  root.append(note('Public hangouts are furnished and open to everyone. Staff NPCs stay at their posts; public decor stays here.'));
  for(const r of bootstrap.rooms){const card=el('section','room-card');card.append(row(r.name,[button(r.ownerId===userId?'My room →':'Visit →',()=>connect(r.id))]));const descriptions={'Hotel Lobby':'Velvet sofas · Reception with Pip','Rooftop Lounge':'City lights · Mocktail bar with Remy','Patio Hangout':'Garden seating · Patio host Fern','Earnly Plaza':'The original shared meeting spot'};card.append(note(r.ownerId===null?descriptions[r.name]||'Public hangout':r.ownerId===userId?'Your personal room':'Player-owned room'));root.append(card);}
  root.append(button('＋ Create room · Free',()=>showRoomCreator(false),'primary'),note('Every room is free. Create another whenever you like. New rooms are private.'));
  if(scene.ownerId===userId)root.append(button(scene.access==='open'?'Close to visitors':'Open to visitors',async()=>{const access=scene.access==='open'?'closed':'open';await action('room_access',{roomId:scene.roomId,access});scene.access=access;await refresh();showRooms();}));
 }
 function showRoomCreator(first=false){
  currentPanel='room-create';const root=openPanel(first?'Choose your first room':'Create a room');
  root.append(el('p','room-picker-intro',first?'Choose 1×–5× the space of an 8 × 8 home. Every size is free, including the 3× split-level suite.':'Choose 1×–5× the space of an 8 × 8 home. Create any size for free.'));
  let selected=window.EarnlyWorldRooms[0],busy=false;
  const grid=el('div','room-layout-grid'),cards=[];
  for(const layout of window.EarnlyWorldRooms){
   const card=button('',()=>{selected=layout;for(const [c,l] of cards)c.setAttribute('aria-pressed',String(l===layout));update();},'room-layout-card');
   card.setAttribute('aria-label',layout.name);card.setAttribute('aria-pressed',String(layout===selected));
   const canvas=el('canvas');canvas.setAttribute('aria-hidden','true');EarnlyWorldRenderer.roomThumbnail(canvas,layout.heightmap);
   card.append(canvas,el('span','room-layout-title',layout.name),el('span','room-layout-detail',layout.detail),el('span','room-free','FREE'));cards.push([card,layout]);grid.append(card);
  }
  const input=el('input');input.id='newRoomName';input.maxLength=40;input.placeholder='Give your room a name';input.value='My Room';
  const label=el('label','room-name-label','Room name');label.htmlFor=input.id;
  const create=button('',async()=>{if(busy)return;busy=true;cards.forEach(([c])=>c.disabled=true);try{
    if(first)await connect('starter-'+selected.id);
    else{const name=input.value.trim();if(!name){input.focus();throw new Error('Give your room a name');}const result=await action('create_room',{name,layout:selected.id});await connect(result.roomId);}
   }finally{busy=false;cards.forEach(([c])=>c.disabled=false);}},'primary room-create-button');
  function update(){create.textContent=first?'Start in '+selected.name:'Create '+selected.name+' · Free';}
  update();root.append(grid);if(!first)root.append(label,input);root.append(create,note('Private to you. Invite visitors later from Rooms.'));
  if(!first)root.append(button('Back to rooms',showRooms));
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
 window.addEventListener('earnly-cloud-auth-change',()=>{clearTimeout(retryTimer);retryCount=0;const previous=socket;socket=null;previous?.close();connected=false;finishConnecting();session=null;placing=null;showPlacement();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Your account changed. Connect again.'));}pending.clear();entryState('Your account changed. Connect to enter your room.');});
 bootstrap.catalog=demoCatalog;entryState();
 window.addEventListener('online',()=>{if(!connected&&!connecting&&retryCount>0)connect(entryTarget,true).catch(e=>entryState(e.message));});
})();
