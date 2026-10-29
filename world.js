(()=>{'use strict';
 const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 let socket=null,connected=false,connecting=false,session=null,userId='preview',scene=null,bootstrap={catalog:[],items:[],rooms:[],friends:[]},placing=null,rotation=0,chat=[],trade=null,currentPanel='',privateTarget=null,toastTimer,needsFirstRoom=false;
 let residentFocus=null,residentFocusTimer;
 const furnitureResults=new Map();
 const pending=new Map();let panelVersion=0;
 let missionEntry=new URLSearchParams(location.search).get('mission');
 const sharedRoom=window.EarnlyWorldLinks.room;
 $('worldSignIn').href=window.EarnlyWorldLinks.signIn();
 let connectTimer,retryTimer,retryCount=0,waitingForNetwork=false,entryTarget=sharedRoom||'choose-home';
 function entryState(message){
  $('worldEntry').hidden=connected;$('worldConnected').hidden=!connected;$('reconnect').hidden=!connected;$('shareRoom').hidden=!connected;
  $('connectWorld').disabled=connecting;$('connectWorld').textContent=connecting?'Connecting…':'Connect to World';
  if(message)$('entryStatus').textContent=message;
  if(connected)requestAnimationFrame(()=>renderer.resize());
 }
 function retryEntry(roomId){
  if(navigator.onLine===false){waitingForNetwork=true;$('connectionStatus').textContent='Offline · Waiting for your connection';entryState('You’re offline. We’ll reconnect when your internet returns. Unsaved changes may need to be tried again.');return true;}
  if(retryCount>=2){$('connectionStatus').textContent='Could not reconnect · Try again';entryState('Automatic reconnect paused after 2 attempts. Tap Connect to World to try again.');return false;}
  const delay=1500*(++retryCount);
  const message='Reconnecting in '+(delay/1000)+' seconds · Attempt '+retryCount+' of 2';$('connectionStatus').textContent=message;entryState(message);
  clearTimeout(retryTimer);retryTimer=setTimeout(()=>connect(roomId,true).catch(e=>entryState(e.message)),delay);return true;
 }
 const demoCatalog=[['mint-sofa','Mint Cloud Sofa','sofa',180,'#59dcc5',2,1],['rose-sofa','Rose Cloud Sofa','sofa',180,'#f599bd',2,1],['arcade-chair','Arcade Chair','chair',60,'#799ff5',1,1],['low-table','Orbit Table','table',80,'#e1b786',1,1],['fern','Moon Fern','plant',70,'#64c786',1,1],['neon-lamp','Neon Tube Lamp','lamp',90,'#c293f3',1,1],['arcade-cabinet','Pocket Arcade Cabinet','arcade',450,'#f6c35e',1,1],['cloud-bed','Cloud Bed','bed',250,'#8cbbf4',1,2],['mint-rug','Mint Tile Rug','rug',40,'#61bfbb',2,2],['star-trophy','First Light Trophy','trophy',600,'#f8d46a',1,1],["palm-tree", "Sunset Palm", "palm", 140, "#65be86", 1, 1, "Garden"],["ficus-tree", "Cloud Ficus", "tree", 125, "#71bc80", 1, 1, "Garden"],["blossom-tree", "Blossom Tree", "tree", 160, "#eea2c2", 1, 1, "Garden"],["flower-pot", "Starlight Flowers", "flowers", 55, "#eab2ed", 1, 1, "Garden"],["oak-bookshelf", "Oak Bookshelf", "bookshelf", 150, "#b88c66", 1, 1, "Essentials"],["reef-aquarium", "Pocket Reef Aquarium", "aquarium", 220, "#67cbd7", 1, 1, "Neon Living"],["sunset-sofa", "Sunset Sofa", "sofa", 180, "#e6a26f", 2, 1, "Neon Living"],["sage-chair", "Sage Garden Chair", "chair", 60, "#91bb96", 1, 1, "Garden"],["garden-parasol", "Garden Parasol Table", "umbrella", 160, "#edbd85", 1, 1, "Garden"],["amber-lantern", "Amber Lantern", "lamp", 90, "#edc582", 1, 1, "Garden"],["lavender-rug", "Lavender Tile Rug", "rug", 40, "#ac93c8", 2, 2, "Neon Living"],["walnut-table", "Walnut Coffee Table", "table", 80, "#aa8069", 1, 1, "Essentials"],["heirloom-clock", "Heirloom Clock", "clock", 220, "#ae8058", 1, 1, "Heritage"],["retro-tv", "Retro TV Cabinet", "television", 190, "#ac8059", 1, 1, "Heritage"],["courtyard-fountain", "Courtyard Fountain", "fountain", 210, "#adc4bd", 1, 1, "Garden"],["woven-divider", "Woven Room Divider", "divider", 120, "#b89b69", 2, 1, "Heritage"],["marble-column", "Marble Column", "column", 100, "#e3d8bc", 1, 1, "Heritage"],["ruby-sofa", "Ruby Velvet Sofa", "sofa", 200, "#b8586b", 2, 1, "Heritage"], ["afterglow-booth","Afterglow Diner Booth","diner-booth",200,"#ef829b",2,1,"Afterglow District"], ["orbit-vending","Orbit Soda Display","vending",260,"#749aeb",1,1,"Afterglow District"], ["holo-table","Starlight Hologram Table","holo-table",180,"#66e6d2",1,1,"Afterglow District"], ["moon-pod","Moonrise Pod Bed","pod-bed",280,"#9c98e9",1,2,"Afterglow District"], ["desert-cactus","Desert Bloom Cactus","cactus",75,"#76bd8c",1,1,"Afterglow District"]].map(([id,name,sprite_id,price,color,width,length,category])=>({id,name,sprite_id,price,color,width,length,category:category||(sprite_id==='plant'?'Garden':sprite_id==='arcade'?'Arcade':sprite_id==='trophy'?'Collectors':'Neon Living'),supply_limit:sprite_id==='trophy'?250:null,minted:0}));
 demoCatalog.push(...EarnlyWorldCollections.allItems.map(d=>({...d})));
 for(const d of demoCatalog)if(EarnlyFurniturePrices[d.id]!==undefined)d.price=EarnlyFurniturePrices[d.id];
 function toast(text){$('worldToast').textContent=text;$('worldToast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('worldToast').hidden=true,4200);}
 function button(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){toast(e.message||'Try again.');}finally{b.disabled=false;}};return b;}
 function row(label,buttons=[]){const r=el('div','panel-row');r.append(el('strong','',label),...buttons);return r;}
 function note(text){return el('p','muted',text);}
 function openPanel(title){stopResidentFocus();const resetScroll=!$('worldPanel').open||$('panelTitle').textContent!==title;panelVersion++;$('worldPanel').classList.remove('shop-panel');$('panelTitle').textContent=title;$('panelContent').replaceChildren();$('panelContent').classList.remove('catalog-content','pet-content');if(resetScroll)$('worldPanel').scrollTop=0;if(!$('worldPanel').open)$('worldPanel').showModal();return $('panelContent');}
 function requireConnection(){if(!connected)throw new Error('Connect to World to enter your room first.');}
 function action(action,data={}){requireConnection();return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Connection timed out. Refresh before retrying a purchase.'));},10000);pending.set(requestId,{resolve,reject,timer});socket.send(JSON.stringify({type:'ACTION',requestId,action,data}));});}
 async function refresh(){bootstrap=await action('bootstrap');$('coinBalance').textContent='◇ '+BigInt(bootstrap.balance||0).toLocaleString();showFirstVisitHint();}
 const renderer=new EarnlyWorldRenderer.WorldRenderer($('worldCanvas'),async hit=>{
  if(hit.door){showRooms();return;}
  if(hit.staff){try{await showStaff(hit.staff);}catch(e){toast(e.message);}return;}
  if(hit.user){showPlayer(hit.user);return;}if(!scene)return;
  if(hit.item&&!connected){toast('Connect to World, then enter your own room to move furniture.');return;}
  if(hit.item&&!placing&&connected){if((hit.doubleTap||hit.longPress)&&scene.ownerId===userId)beginPlacement(hit.item,hit.item.name,true);else if(hit.item.canSit||hit.item.canLay){try{useSeat(hit.item);}catch(e){toast(e.message);}}else showDecor(hit.item);return;}
  const rows=scene.heightmap.split('\n');if(hit.x<0||hit.y<0||hit.y>=rows.length||hit.x>=rows[0].length||rows[hit.y][hit.x]==='x')return;
  if(placing?.guided){renderer.placement={item:placing,x:hit.x,y:hit.y,rotation,explicitConfirm:true};showPlacement();return;}
  if(placing){try{await action('place',{itemId:placing.id,x:hit.x,y:hit.y,rotation,centered:false});placing=null;showPlacement();await refresh();completeGuideStep('decorate');toast('Placed in your room');}catch(e){toast(e.message);}return;}
  if(connected){const item=(scene.items||[]).find(i=>{const rotated=i.rotation===2||i.rotation===6;return hit.x>=i.x&&hit.y>=i.y&&hit.x<i.x+(rotated?i.length:i.width)&&hit.y<i.y+(rotated?i.width:i.length);});socket.send(JSON.stringify(item&&(item.canSit||item.canLay)?{type:'INTERACT',x:hit.x,y:hit.y,action:item.canLay?'lay':'sit'}:{type:'MOVE_TO',x:hit.x,y:hit.y}));}else renderer.updateUser({userId,username:'You',position:{x:hit.x,y:hit.y,z:0}});
 });
 function setScene(value){if(scene?.roomId!==value.roomId){stopResidentFocus();$('placementSuccess').hidden=true;placing=null;showPlacement();}scene=value;for(const item of value.items||[]){const result=furnitureResults.get(item.id);if(result)Object.assign(item,result);}renderer.setScene(value);$('roomInvitation').hidden=value.ownerId!==userId||(value.items||[]).length>=3;updateViewButtons();$('roomName').textContent=value.name||'Earnly Plaza';$('renameRoom').hidden=value.ownerId!==userId;$('roomKind').textContent=value.ownerId===userId?'YOUR PERSONAL SPACE':value.ownerId?'PLAYER ROOM':'PUBLIC HANGOUT';$('stageTip').textContent=connected&&value.ownerId===userId?'Hold or double-tap furniture to move · Pinch to zoom':'Tap seats to sit · Pinch to zoom';}
 function beginPlacement(item,name,gesture=false){$('placementSuccess').hidden=true;requireConnection();if(scene.ownerId!==userId)throw new Error('Enter your own room to decorate.');renderer.clearPlacement();placing={...item,name,centered:false};rotation=scene.items.find(i=>i.id===item.id)?.rotation??0;if(gesture){renderer.selected=null;renderer.placement={item:{...item,centered:false},x:item.x,y:item.y,rotation};renderer.lastTap=null;}showPlacement();$('worldPanel').close();}
 function useSeat(item){const rotated=item.rotation===2||item.rotation===6,w=rotated?item.length:item.width,h=rotated?item.width:item.length;const occupied=new Set([...renderer.users.values(),...renderer.staff.values()].map(u=>u.position.x+','+u.position.y));const seats=[];for(let y=item.y;y<item.y+h;y++)for(let x=item.x;x<item.x+w;x++)if(!occupied.has(x+','+y))seats.push({x,y});if(!seats.length)throw new Error('This seat is occupied. Choose another seat.');const me=renderer.users.get(userId)?.position||item;seats.sort((a,b)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y));socket.send(JSON.stringify({type:'INTERACT',...seats[0],action:item.canLay?'lay':'sit'}));$('worldPanel').close();toast('Walking to '+item.name+' · Tap clear floor to stand up');}
 function showDecor(item){
  if(!connected)return;
  currentPanel='decor';const root=openPanel(item.name||'Room decor');
  const preview=el('canvas');preview.className='decor-room-preview';EarnlyWorldRenderer.decorPreview(preview,item);root.append(preview);
  const sprite=item.sprite||item.sprite_id,dice=['play-neon-dice','play-clockwork-dice'].includes(sprite),serve=sprite==='play-soft-serve',roller=sprite==='play-neon-roller';
  root.append(note(dice?'Walk beside it, then roll a number from 1–6. Everyone sees the same result.':serve?'Walk beside it, then serve a treat.':roller?'Step on to ride. Tap beside the belt to step off. Rotate to change direction.':'A decorative piece for your space.'));
  if(dice||serve)root.append(button(dice?'Roll dice · Free':'Serve ice cream · Free',()=>{socket.send(JSON.stringify({type:'INTERACT',x:item.x,y:item.y,action:dice?'roll':'serve'}));$('worldPanel').close();},'primary'));
  if(roller)root.append(button('Step onto roller',()=>{socket.send(JSON.stringify({type:'MOVE_TO',x:item.x,y:item.y}));$('worldPanel').close();},'primary'));
  const definition=bootstrap.catalog.find(d=>d.id===item.definitionId);if(definition)root.append(button('Explore '+definition.category,()=>showCatalog(definition.category)));
  if(scene.ownerId===userId&&bootstrap.centeredTables&&item.width===1&&item.length===1&&['table','bistro-table','holo-table'].includes(item.sprite||item.sprite_id)){
   const rugs=scene.items.filter(i=>i.sprite==='rug'&&i.width===2&&i.length===2&&i.canStack&&i.walkable);
   if(rugs.length)root.append(button('Center on rug',()=>{const choose=openPanel('Center table on a rug');choose.append(note('Choose a rug with a clear center.'));for(const rug of rugs)choose.append(button(rug.name+' · tile '+(rug.x+1)+', '+(rug.y+1),async()=>{await action('place',{itemId:item.id,centerOnRug:rug.id,rotation:item.rotation||0});await refresh();$('worldPanel').close();toast('Table centered on rug');}));}));
  }
  if(scene.ownerId===userId)root.append(button('Move',()=>beginPlacement(item,item.name),'primary'),button('Rotate ↻',async()=>{await action('place',{itemId:item.id,x:item.x,y:item.y,rotation:(item.rotation+2)%8});await refresh();$('worldPanel').close();toast('Furniture rotated');}),button('Return to Backpack',async()=>{await action('place',{itemId:item.id,pickup:true});await refresh();$('worldPanel').close();toast('Returned to your Backpack');}));
 }
 renderer.onPlacementStatus=(check,p)=>{const text=p.saving?'Saving…':check.valid?'Fits here · Ready to place':(check.reason||'Choose a clear floor tile');const label=$('placementStatus');if(label.textContent!==text)label.textContent=text;if(label.dataset.valid!==String(check.valid))label.dataset.valid=String(check.valid);};
 // A furniture double-tap may reveal this dock under the finger. Do not let
 // the same gesture's synthesized click activate a newly exposed action.
 let placementPress=null;
 document.addEventListener('pointerdown',e=>{placementPress=e.target.closest?.('#placementHint button')||null;},true);
 document.addEventListener('pointercancel',()=>{placementPress=null;},true);
 $('placementHint').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;const startedHere=placementPress===button;placementPress=null;if(e.detail>0&&!startedHere){e.preventDefault();e.stopImmediatePropagation();}},true);
 function showPlacement(){ if(!placing){renderer.clearPlacement();$('placementStatus').textContent='';}$('placementInstructions').textContent=renderer.placement?'Slide to move · Tap elsewhere or double-tap to drop':placing?.guided?'Tap a floor tile to preview · Nothing is saved yet':'Tap a floor tile to place';if(renderer.placement?.explicitConfirm)$('placementInstructions').textContent='Tap or slide to adjust · Green fits · Tap Place here to save';$('placementHint').hidden=!placing;document.body.classList.toggle('is-placing',!!placing);document.body.classList.toggle('is-guided-placing',!!placing?.guided);$('dropItem').hidden=!renderer.placement;$('stageTip').hidden=!!placing;$('placingName').textContent=placing?.name||'';$('returnItem').hidden=!placing||!scene?.items.some(i=>i.id===placing.id);}
 $('rotateItem').onclick=()=>{if(renderer.placement?.saving)return;rotation=(rotation+2)%8;if(renderer.placement)renderer.placement.rotation=rotation;toast('Rotated '+(rotation*45)+'°');};$('cancelPlace').onclick=()=>{if(renderer.placement?.saving)return;placing=null;showPlacement();};
 $('returnItem').onclick=async()=>{
  const p=renderer.placement;if(!p||p.saving||!renderer.canEditItem(p.item))return;
  p.saving=true;for(const id of ['dropItem','rotateItem','returnItem','cancelPlace'])$(id).disabled=true;
  try{await action('place',{itemId:p.item.id,pickup:true});if(renderer.placement===p){placing=null;showPlacement();}await refresh();toast('Returned to your Backpack');}
  catch(e){toast(e.message);}
  finally{p.saving=false;for(const id of ['dropItem','rotateItem','returnItem','cancelPlace'])$(id).disabled=false;}
 };
 renderer.canEditItem=item=>connected&&scene?.ownerId===userId&&bootstrap.items.some(i=>i.id===item.id);
 renderer.onPlacementDrop=async nextItem=>{
  const p=renderer.placement,roomId=scene?.roomId;if(!p||p.saving)return;
  const check=renderer.placementResult();if(!check.valid){toast(check.reason||'Cannot place here · Slide to a green tile');return;}
  p.saving=true;$('dropItem').disabled=true;$('rotateItem').disabled=true;$('returnItem').disabled=true;$('cancelPlace').disabled=true;
  try{await action('place',{itemId:p.item.id,x:p.x,y:p.y,rotation:p.rotation,centered:false});if(renderer.placement===p){placing=null;showPlacement();await refresh();completeGuideStep('decorate');toast('Furniture placed · Saved in your room');if(p.explicitConfirm)$('placementSuccess').hidden=false;if(nextItem&&scene?.roomId===roomId&&!placing){const next=scene.items.find(i=>i.id===nextItem.id);if(next&&renderer.canEditItem(next))beginPlacement(next,next.name,true);}}}
  catch(e){toast(e.message);}
  finally{p.saving=false;$('dropItem').disabled=false;$('rotateItem').disabled=false;$('returnItem').disabled=false;$('cancelPlace').disabled=false;}
 };
 $('dropItem').onclick=()=>renderer.onPlacementDrop();
 const updateViewButtons=()=>{$('roomView').setAttribute('aria-pressed',String(renderer.viewMode==='room'));};
 $('viewLeft').onclick=()=>renderer.rotateView(-1);$('viewRight').onclick=()=>renderer.rotateView(1);
 $('zoomIn').onclick=()=>renderer.setZoom(renderer.zoom+.2);$('zoomOut').onclick=()=>renderer.setZoom(renderer.zoom-.2);
 $('roomView').onclick=()=>{renderer.resetView();updateViewButtons();};
 $('focusMe').onclick=()=>{renderer.focusMe();updateViewButtons();};
 $('worldPanel').addEventListener('close',()=>{if(!$('worldPanel').open)stopResidentFocus();});
 $('closePanel').onclick=()=>$('worldPanel').close();
 $('worldPanel').addEventListener('click',e=>{if(e.target===$('worldPanel')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
 function finishConnecting(){clearTimeout(connectTimer);connecting=false;$('reconnect').disabled=false;$('reconnect').textContent=connected?'Reconnect':'Connect';entryState();}
 async function connect(roomId='choose-home',retry=false){
  clearTimeout(retryTimer);if(!retry)retryCount=0;entryTarget=roomId;
  if(connecting)return;
  if(navigator.onLine===false){retryEntry(roomId);return;}
  waitingForNetwork=false;
  const endpoint=window.EarnlyWorldConfig?.endpoint;
  if(!endpoint){toast('World is temporarily unavailable. Please try again shortly.');return;}
  if(!/^wss:\/\//.test(endpoint))throw new Error('Secure World connection required');
  connecting=true;entryState('Connecting to your room… The server may need a moment to wake up.');$('worldSignIn').hidden=true;$('reconnect').disabled=true;$('reconnect').textContent='Connecting…';
  try{
  session=await window.EarnlyCloud?.session();if(!session){finishConnecting();$('worldSignIn').hidden=false;entryState('Sign in once to enter your own room and meet other players.');openPanel('Join Earnly World').append(note('Sign in to start in your own room with your saved potato avatar.'),Object.assign(el('a','primary','Sign in'),{href:window.EarnlyWorldLinks.signIn()}));return;}
  const token=session.access_token;
  window.EarnlyActivity?.track('world_attempt');if(retry)window.EarnlyActivity?.track('world_reconnect');
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
  const ws=new WebSocket(endpoint);socket=ws;let admitted=false,failed=false;
  const trackFailure=()=>{if(!failed&&!admitted){failed=true;window.EarnlyActivity?.track('world_failure');}};
  // Allow the free server to wake up, but never leave Connect disabled forever.
  connectTimer=setTimeout(()=>{
   if(socket!==ws||connected)return;
   trackFailure();socket=null;ws.close();finishConnecting();
   $('connectionStatus').textContent='Connection timed out · Tap Connect to retry';
   $('worldNote').textContent='Your saved room and furniture are safe. Check your connection and try again.';if(!retryEntry(roomId))entryState('Connection timed out. Tap Connect to World to try again.');
  },75000);
  ws.onopen=()=>{if(socket===ws)ws.send(JSON.stringify({type:'JOIN',version:1,token,roomId}));};
  ws.onmessage=e=>{if(socket!==ws)return;let p;try{p=JSON.parse(e.data);}catch{return;}
   // Safari/proxies can report an abnormal close instead of the server close code.
   // Handle onboarding as an application message, before the transport closes.
   if(p.type==='ROOM_CHOICE_REQUIRED'){socket=null;ws.close();connected=false;needsFirstRoom=true;clearTimeout(retryTimer);finishConnecting();entryState('Choose your first room — it is free.');$('connectionStatus').textContent='Choose your first room';showRoomCreator(true);return;}
   if(p.type==='RESULT'){const r=pending.get(p.requestId);if(r){clearTimeout(r.timer);pending.delete(p.requestId);p.error?r.reject(Object.assign(new Error(p.error),{definite:p.definite===true})):r.resolve(p.data);}return;}
   if(p.type==='NPC_SNAPSHOT')renderer.setStaff(p.staff);
   else if(p.type==='ROOM_SNAPSHOT')renderer.setUsers(p.users);
   else if(p.type==='USER_JOINED')renderer.updateUser(p);
   else if(p.type==='USER_LEFT')renderer.users.delete(p.userId);
   else if(p.type==='ROOM_DELTA')p.users.forEach(u=>{const before=renderer.users.get(u.userId);if(u.userId===userId&&before&&(before.position.x!==u.position.x||before.position.y!==u.position.y))completeGuideStep('walk');renderer.updateUser(u);});
   else if(p.type==='WELCOME'){admitted=true;connected=true;retryCount=0;waitingForNetwork=false;needsFirstRoom=false;finishConnecting();userId=p.userId;renderer.localUserId=userId;bootstrap=p.bootstrap;residentQuiet=bootstrap.residentQuiet===true;setScene(p.scene);if(bootstrap.aiResidents)socket.send(JSON.stringify({type:'RESIDENT_VIEW',version:1}));if(bootstrap.personalPets)socket.send(JSON.stringify({type:'ANIMAL_VIEW',version:1}));chat=[];$('connectionStatus').textContent='Live · Tap a tile to walk';$('worldNote').textContent='Your saved avatar. Your own rooms. Arcade Coins and decor have no cash value.';$('coinBalance').textContent='◇ '+BigInt(bootstrap.balance||0).toLocaleString();$('worldPanel').close();showFirstVisitHint();if(!scene.ownerId)completeGuideStep('visit');if(guideDecorateOnArrival&&scene.ownerId===userId){guideDecorateOnArrival=false;showFirstPiece();}}
   else if(p.type==='SCENE')setScene(p.scene);
   else if(p.type==='PET_REACTION')renderer.petReaction(p);
   else if(p.type==='FURNITURE_RESULT'){
    if(p.error){toast(p.error);return;}
    const item=scene?.items?.find(i=>i.id===p.itemId);
    if(p.kind==='dice'&&Number.isInteger(p.value)&&p.value>=1&&p.value<=6){const result={diceValue:p.value,diceRollingUntil:p.snapshot?0:performance.now()+800};if(furnitureResults.size>=2048)furnitureResults.clear();furnitureResults.set(p.itemId,result);if(item){Object.assign(item,result);renderer.setScene(scene);}}
    if(!p.snapshot){const text=p.kind==='dice'?'Rolled '+p.value+' 🎲':'Ice cream served! 🍦';renderer.bubble({userId:p.userId,text,mode:'normal'});toast(text);}
   }
   else if(p.type==='AI_GREETING'&&!residentQuiet){renderer.bubble({userId:p.staffId,text:p.text,mode:'ai'});}
   else if(p.type==='PET_CHAT')renderer.bubble({userId:p.staffId,text:p.text,mode:'pet'});
   else if(p.type==='CHAT'){chat.push(p);chat=chat.slice(-80);renderer.bubble(p);if(currentPanel==='chat'&&$('worldPanel').open)showChat();}
   else if(p.type==='ROOM_NAME'){if(scene?.roomId===p.roomId){scene.name=p.name;$('roomName').textContent=p.name;}for(const r of bootstrap.rooms)if(r.id===p.roomId)r.name=p.name;}
   else if(p.type==='ROOM_INVITE'){ $('worldCommunity').textContent='Community · New invite';toast('A friend invited you to a room. Open Room invitations.');}
   else if(p.type==='PRIVATE'&&p.userId!==userId){toast('New private message from '+p.username);if(privateTarget&&$('worldPanel').open)showPrivate(privateTarget);}
   else if(p.type==='TRADE'){trade=p.trade;if(trade.status==='complete')refresh().catch(()=>{});showTrade();}
   if(p.type==='WELCOME'){const category=new URLSearchParams(location.search).get('catalog');if(category)showCatalog(category);else if(missionEntry){const entry=missionEntry;missionEntry=null;if(entry==='daily')showDailyMissions();else if(entry==='weekly')showWeeklyChallenge();}}
   if(connected){const players=renderer.users.size,residents=[...renderer.staff.values()].filter(s=>s.isAI).length,total=players+residents;$('peopleCount').dataset.players=String(players);$('peopleCount').textContent=bootstrap.aiResidents?total+(total===1?' Spud here':' Spuds here'):players+' in the room';const state=renderer.users.get(userId)?.state;$('connectionStatus').textContent=state==='sit'?'Live · Sitting · Tap clear floor to stand up':state==='lay'?'Live · Lying down · Tap clear floor to stand up':'Live · Tap seats to sit or a floor tile to walk';}
  };
  ws.onclose=e=>{if(socket!==ws)return;stopResidentFocus();if(e.code!==4004)trackFailure();connected=false;finishConnecting();placing=null;showPlacement();$('peopleCount').textContent='Room preview';$('worldNote').textContent='Your room is not connected. Enter your own room after connecting to move furniture.';if(e.code===4004){needsFirstRoom=true;entryState('Choose your first room — it is free.');$('connectionStatus').textContent='Choose your first room';showRoomCreator(true);return;}$('connectionStatus').textContent=e.code===1011&&e.reason==='World service configuration'?'World is temporarily unavailable · Server setup needs attention.':e.code===4001?'Your session expired · Sign in again to enter World.':e.code===4003?'Confirm your account email before entering World.':e.code===1013?'Room loading timed out · Tap Connect to retry.':e.code===1008?'Entry unavailable · Sign in again, close other World tabs, then reconnect.':'Disconnected · Reconnect to keep playing';if(roomId===sharedRoom&&e.code===1008){$('connectionStatus').textContent='This room is unavailable. It may be private, full, or removed.';openPanel('Room unavailable').append(note('A shared link does not bypass room permissions.'),button('Go to my room',()=>connect('choose-home'),'primary'));}entryState($('connectionStatus').textContent);if(e.code===4001||e.code===4003){$('worldSignIn').hidden=false;}if([1006,1012,1013].includes(e.code))retryEntry(roomId);for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Disconnected. Reconnect before retrying.'));}pending.clear();};
  ws.onerror=()=>{if(socket===ws)$('connectionStatus').textContent='Could not connect to World. Please try again.';};
  }catch(error){finishConnecting();entryState(error.message);throw error;}
 }
 $('reconnect').onclick=()=>{if(connected)window.EarnlyActivity?.track('world_reconnect');if(needsFirstRoom)showRoomCreator(true);else connect(entryTarget).catch(e=>{entryState(e.message);toast(e.message);});};
 $('connectWorld').onclick=$('reconnect').onclick;
 function collectionPreview(canvas,collection,catalog=demoCatalog){EarnlyWorldRenderer.roomThumbnail(canvas,'000000\n000000\n000000\n000000\n000000\n000000',EarnlyWorldCollections.vignette(collection,catalog));}
 const wishlistKey='earnlyWorldWishlistV1';
 function readWishlist(){try{const ids=JSON.parse(localStorage.getItem(wishlistKey)||'[]');return new Set(Array.isArray(ids)?ids.filter(id=>typeof id==='string'&&id.length<100).slice(0,200):[]);}catch{return new Set();}}
 function wishlistButton(d,onChange=()=>{}){const b=button('',()=>{const ids=readWishlist();if(ids.has(d.id))ids.delete(d.id);else{if(ids.size>=200)throw new Error('Your wishlist is full. Remove a piece before saving another.');ids.add(d.id);}try{localStorage.setItem(wishlistKey,JSON.stringify([...ids]));}catch{throw new Error('Could not save your wishlist on this device. Please try again.');}update();onChange();toast(ids.has(d.id)?'Saved to your wishlist':'Removed from your wishlist');},'wishlist-save');function update(){const saved=readWishlist().has(d.id);b.textContent=saved?'♥ Saved':'♡ Save';b.setAttribute('aria-label',(saved?'Remove from wishlist: ':'Save to wishlist: ')+d.name);b.setAttribute('aria-pressed',String(saved));}update();return b;}
 function shopAvailable(d){return EarnlyWorldCollections.isShopAvailable(d);}
 function showCatalog(category='All',view={}){
  currentPanel='catalog';const root=openPanel('Decor Catalog');root.classList.add('catalog-content');$('worldPanel').classList.add('shop-panel');const nav=el('nav','shop-nav');nav.setAttribute('aria-label','Shop sections');nav.append(button('Furniture',()=>showCatalog(),'selected'));if(bootstrap.personalPets&&bootstrap.petsEnabled)nav.append(button('Pet Shop',()=>showPets(true)));nav.append(button('View Backpack',showBackpack,'catalog-backpack'));root.append(nav);
  // An off-season receipt can still be confirmed after a lost connection.
  try{const pendingBuy=JSON.parse(localStorage.getItem('earnlyWorldPendingPurchase:'+userId)||'null'),definition=bootstrap.catalog.find(d=>d.id===pendingBuy?.definitionId);if(definition&&connected)root.append(button('Confirm previous purchase',()=>showBuy(definition,null,()=>showCatalog(category,view))));}catch{}
  const boost=el('a','catalog-backpack','Daily Furniture Boost');boost.href='rewards.html#daily-furniture-boost';boost.hidden=true;root.append(boost);
  window.EarnlyCloud?.adBonus?.().then(s=>{if(s?.enabled){boost.hidden=false;boost.textContent=s.awarded?'Daily Furniture Boost · Complete':`Daily Furniture Boost · ${s.watched}/5 · ${s.coins||100} Coins`;}}).catch(()=>{});
  if(category==='All'){
   const vip=el('section','world-vip-showcase');vip.append(el('strong','','VIP · Preview monthly furniture gifts'),note('One furniture gift per verified paid month. Cosmetic only. Keep paid-month gifts after cancellation.'));const gifts=el('div','world-vip-previews');for(const d of bootstrap.catalog.filter(d=>d.vip_only&&shopAvailable(d))){const preview=button('',()=>showFurniturePreview(d,()=>showCatalog()));const canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,d);preview.append(canvas,el('span','',d.name));gifts.append(preview);}if(gifts.children.length)vip.append(gifts);appendVipLink(vip);root.append(vip);
   const collectionToggle=el('details','catalog-collections'),summary=el('summary','','Explore furniture collections');collectionToggle.append(summary);const showcase=el('div','collection-showcase');
   for(const set of EarnlyWorldCollections.collections){const available=set.ids.map(id=>bootstrap.catalog.find(d=>d.id===id)).filter(d=>d&&shopAvailable(d));if(!available.length)continue;
    const card=el('section','collection-card'),canvas=el('canvas');canvas.setAttribute('aria-label',set.name+' furniture inspiration');collectionPreview(canvas,set,bootstrap.catalog);
    card.style.setProperty('--collection-color',set.color);card.append(canvas,el('p','collection-tag',set.tag),el('h3','',set.name),note(set.description));
    const owned=available.filter(d=>bootstrap.items.some(i=>i.definition_id===d.id)).length;card.append(el('p','collection-meta',owned+' / '+available.length+' styles owned · From ◇ '+Math.min(...available.map(d=>Number(d.price)))));
    card.append(button('Explore '+set.name,()=>showCatalog(set.name)));showcase.append(card);
   }collectionToggle.append(showcase);root.append(collectionToggle);
  }else{if(category==='Pet Toys')root.append(note('Little moments of play, with plenty of rest. Match a toy to your companion and leave a few clear tiles around it. Call over interrupts play.'));if(category==='Pet Comfort')root.append(note('A cozy spot for each companion. Match the bed to your pet; they will find it when they feel sleepy. Call over wakes them.'));const set=EarnlyWorldCollections.collections.find(c=>c.name===category);if(set)root.append(note(set.description));}
  const vip=root.querySelector('.world-vip-showcase'),collections=root.querySelector('.catalog-collections');if(vip&&collections){collections.querySelector('summary').textContent='Explore furniture collections & VIP';collections.insertBefore(vip,collections.querySelector('.collection-showcase'));}
  let savedOnly=!!view.savedOnly,ownership=view.ownership||'all',budgetOnly=connected&&!!view.budgetOnly;const filters=el('div','filters');filters.setAttribute('aria-label','Furniture collections');for(const name of ['All',...new Set(bootstrap.catalog.filter(shopAvailable).map(d=>d.category))]){const b=button(name,()=>showCatalog(name,{...catalogView(),scroll:0}),name===category?'selected':'');b.setAttribute('aria-pressed',String(name===category));filters.append(b);}root.append(filters);
  const tools=el('div','catalog-search'),search=el('input'),sort=el('select');search.type='search';search.placeholder='Find a piece for your room';search.setAttribute('aria-label','Search decor');sort.setAttribute('aria-label','Sort decor');for(const [value,label]of [['featured','Featured'],['price','Price: low to high']]){const option=el('option','',label);option.value=value;sort.append(option);}tools.append(search,sort);const wishlist=button('',()=>{savedOnly=!savedOnly;draw();},'wishlist-filter');tools.append(wishlist);const refine=el('details','catalog-refine');refine.open=!!view.refine;refine.append(el('summary','','Filter & sort'));const refinements=el('div','catalog-refinements');refinements.append(sort,wishlist);refine.append(refinements);nav.after(tools,refine,filters);
  const budget=button('Within my budget',()=>{budgetOnly=!budgetOnly;draw();},'budget-filter');budget.hidden=!connected;refinements.insertBefore(budget,wishlist);sort.classList.add('catalog-sort');
  const catalogView=()=>({search:search.value,sort:sort.value,scroll:$('worldPanel').scrollTop,savedOnly,ownership,budgetOnly,refine:refine.open});
  const returnToCatalog=()=>{const savedView=catalogView();return ()=>showCatalog(category,savedView);};
  const ownershipFilters=el('div','catalog-ownership');ownershipFilters.setAttribute('role','group');ownershipFilters.setAttribute('aria-label','Furniture ownership');
  for(const [value,label]of [['all','All pieces'],['owned','Owned'],['unowned','Not owned']]){const b=button(label,()=>{ownership=value;draw();});b.dataset.ownership=value;ownershipFilters.append(b);}refinements.append(ownershipFilters);
  const count=el('p','catalog-count'),grid=el('div','catalog-grid'),empty=note('No pieces match. Try another name or collection.');count.setAttribute('role','status');const reset=button('Clear filters',()=>{showCatalog('All');requestAnimationFrame(()=>{if(currentPanel==='catalog')$('worldPanel').querySelector('[aria-label="Search decor"]')?.focus();});},'catalog-reset');const results=el('div','catalog-results');results.append(count,reset);root.append(results,grid,empty);if(collections)results.before(collections);
  const draw=()=>{budget.setAttribute('aria-pressed',String(budgetOnly));reset.hidden=category==='All'&&!search.value&&!savedOnly&&!budgetOnly&&ownership==='all'&&sort.value==='featured';for(const b of ownershipFilters.children)b.setAttribute('aria-pressed',String(b.dataset.ownership===ownership));const saved=readWishlist();wishlist.textContent='♥ Wishlist · '+saved.size;wishlist.setAttribute('aria-pressed',String(savedOnly));empty.textContent=savedOnly?'No saved pieces match. Tap Save on a piece you like.':'No pieces match. Try another name or collection.';grid.replaceChildren();let pieces=bootstrap.catalog.filter(d=>shopAvailable(d)&&(category==='All'||d.category===category)&&(d.name+' '+d.category).toLowerCase().includes(search.value.trim().toLowerCase()));if(budgetOnly)pieces=pieces.filter(d=>!d.vip_only&&Number(d.price)<=Number(bootstrap.balance)&&(!d.supply_limit||d.minted<d.supply_limit));if(savedOnly)pieces=pieces.filter(d=>saved.has(d.id));if(ownership!=='all')pieces=pieces.filter(d=>bootstrap.items.some(i=>i.definition_id===d.id)===(ownership==='owned'));if(sort.value==='price')pieces.sort((a,b)=>Number(a.price)-Number(b.price));count.textContent=pieces.length+(savedOnly?' saved pieces · Saved on this device':ownership==='owned'?' owned styles':' pieces');if(!savedOnly&&ownership==='owned')empty.textContent=connected?'No owned pieces match these filters. Try All pieces or another collection.':'Connect to World to see the furniture you own.';if(budgetOnly){count.textContent+=' · Within your budget';if(!pieces.length)empty.textContent='No available pieces match your budget and filters. Try clearing filters or save a favorite for later.';}empty.hidden=pieces.length>0;
   for(const d of pieces){const card=el('article','item-card'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,d);const inspect=button('',()=>showFurniturePreview(d,returnToCatalog()), 'furniture-inspect');inspect.setAttribute('aria-label','Preview '+d.name);inspect.append(canvas,el('span','','Preview'));card.append(inspect,el('h3','',d.name),wishlistButton(d,()=>{if(savedOnly)draw();else wishlist.textContent='♥ Wishlist · '+readWishlist().size;}));
    const owned=bootstrap.items.filter(i=>i.definition_id===d.id).length;if(owned){card.classList.add('item-owned');inspect.append(el('span','catalog-owned-badge','✓ Owned · '+owned));card.append(el('p','owned-label',owned+' owned'),el('p','owned-location',furnitureOwnership(d)));}
    card.append(el('p','item-footprint',d.width+' × '+d.length+' tiles · '+(d.sprite_id?.startsWith('pet-bed-')?'For your '+d.sprite_id.slice(8):d.can_sit?'Take a seat':d.can_lay?'Lie down':d.walkable?'Floor decor':'Room decor')));
    card.append(el('p','',d.vip_only?'VIP monthly gift · Not tradeable':d.supply_limit?`${Math.max(0,d.supply_limit-d.minted)} of ${d.supply_limit} left`:d.tradeable===false?'Keep & decorate':'Collect · Decorate · Trade'));
    const ownedAction=ownedFurnitureAction(d);if(ownedAction){card.classList.add('has-owned-action');ownedAction.setAttribute('aria-label',ownedAction.textContent);if(ownedAction.classList.contains('owned-place'))ownedAction.textContent=ownedAction.textContent.startsWith('Move')?'Move':'Place';card.append(ownedAction);}
    const soldOut=d.supply_limit&&d.minted>=d.supply_limit;const buy=button(d.vip_only?'VIP exclusive':soldOut?'Sold out':'◇ '+Number(d.price).toLocaleString()+(owned?' · Buy another':' · Buy'),()=>showBuy(d,null,returnToCatalog()));buy.disabled=d.vip_only||!connected||d.supply_limit&&d.minted>=d.supply_limit;card.append(buy);grid.append(card);
   }
  };search.value=view.search||'';sort.value=view.sort||'featured';search.oninput=draw;sort.onchange=draw;draw();requestAnimationFrame(()=>{$('worldPanel').scrollTop=view.scroll||0;const selected=filters.querySelector('.selected');if(selected)filters.scrollLeft=selected.offsetLeft-filters.offsetLeft;});
 }
 function furnitureOwnership(d){const items=bootstrap.items.filter(i=>i.definition_id===d.id),packed=items.filter(i=>!i.room_id).length,here=items.filter(i=>i.room_id===scene?.roomId).length,elsewhere=items.length-packed-here;return [packed?packed+' in Backpack':null,here?here+' in this room':null,elsewhere?elsewhere+' in other rooms':null].filter(Boolean).join(' · ');}
 function appendVipLink(root){const link=el('a','world-vip-link','See this month’s gift & VIP details ↗');link.href='avatars.html#vip-pass';link.target='_blank';link.rel='noopener';root.append(link);}
 function ownedFurnitureAction(d){if(!connected)return null;const item=bootstrap.items.find(i=>i.definition_id===d.id&&!i.room_id)||bootstrap.items.find(i=>i.definition_id===d.id&&i.room_id===scene.roomId);if(!item)return null;if(scene.ownerId!==userId)return button('Go home to place',()=>connect('choose-home'));return button(item.room_id?'Move owned piece':'Place owned piece',()=>beginPlacement(item,d.name),'primary owned-place');}
 function furnitureColorPicker(root,d,selected,onChange,locked=false){
  const group=el('div','furniture-colors'),label=el('p','furniture-color-label');group.setAttribute('role','group');group.setAttribute('aria-label','Furniture color');
  const options=[{name:'Original',color:null},...(!d.vip_only?(connected?bootstrap.furnitureColors||[]:EarnlyWorldCollections.furnitureColors):[])];
  const draw=()=>{label.textContent='Color: '+(options.find(o=>o.color===selected)?.name||'Original');for(const b of group.children)b.setAttribute('aria-pressed',String(b.dataset.color===(selected||'')));};
  for(const option of options){const b=button(option.name,()=>{selected=option.color;draw();onChange(selected);},'furniture-swatch');b.dataset.color=option.color||'';b.style.setProperty('--swatch',option.color||d.color);b.disabled=locked;b.setAttribute('aria-label','Color: '+option.name);group.append(b);}
  root.append(label,group);draw();
 }
 function showFurniturePreview(d,back){
  currentPanel='catalog';const root=openPanel(d.name),stage=el('section','furniture-stage'),canvas=el('canvas'),caption=el('p','furniture-preview-status');let facing=0,tone='midnight',selectedColor=null;
  canvas.className='decor-room-preview';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',d.name+' on a sample room floor');caption.setAttribute('role','status');
  const draw=()=>{EarnlyWorldRenderer.decorPreview(canvas,{...d,color:selectedColor||d.color,rotation:facing},{tone});caption.textContent=(facing===0?'Original view':'Turned view '+facing*45+'°')+' · '+tone.charAt(0).toUpperCase()+tone.slice(1)+' floor';};
  const rotate=button('Rotate preview ↻',()=>{facing=(facing+2)%8;draw();});stage.append(canvas,caption,rotate);root.append(stage);furnitureColorPicker(root,d,selectedColor,color=>{selectedColor=color;draw();});
  const tones=el('div','preview-tones');tones.setAttribute('role','group');tones.setAttribute('aria-label','Preview floor');
  for(const name of ['midnight','warm','garden']){const b=button(name.charAt(0).toUpperCase()+name.slice(1),()=>{tone=name;for(const child of tones.children)child.setAttribute('aria-pressed',String(child===b));draw();});b.setAttribute('aria-pressed',String(name===tone));tones.append(b);}root.append(tones);
  root.append(el('p','item-footprint',d.width+' × '+d.length+' tiles · '+(d.sprite_id?.startsWith('pet-bed-')?'For your '+d.sprite_id.slice(8):d.can_sit?'Take a seat':d.can_lay?'Lie down':d.walkable?'Floor decor':'Room decor')),note('Sample floor for inspiration. Furniture is sold separately.'));
  const owned=bootstrap.items.filter(i=>i.definition_id===d.id).length;if(owned)root.append(el('p','owned-label',owned+' owned'),el('p','owned-location',furnitureOwnership(d)));
  const ownedAction=ownedFurnitureAction(d);if(ownedAction)root.append(ownedAction);
  if(d.vip_only){root.append(note('VIP monthly gift · Not available for individual purchase.'));appendVipLink(root);}
  else if(!shopAvailable(d))root.append(note('This seasonal piece returns October 1. Owned pieces stay in your Backpack.'));
  else if(d.supply_limit&&d.minted>=d.supply_limit)root.append(note('This piece is sold out.'));
  else{root.append(el('p','furniture-price','◇ '+Number(d.price).toLocaleString()+' Arcade Coins'));if(connected)root.append(button('Choose this piece',()=>showBuy(d,selectedColor,back),'primary'));else root.append(note('Connect to World to buy this piece.'));}
  root.append(wishlistButton(d),el('p','wishlist-note','Wishlist saved on this device.'),button('Back to catalog',back));draw();
 }
 function showBuy(d,initialColor=null,back=()=>showCatalog()){
  const root=openPanel('Add to your Backpack?'),preview=el('canvas');preview.className='decor-room-preview';
  const purchaseKey='earnlyWorldPendingPurchase:'+userId;let saved;try{saved=JSON.parse(localStorage.getItem(purchaseKey)||'null');}catch{}
  const retry=saved?.definitionId===d.id;let selectedColor=retry?saved.color||null:initialColor;const requestId=retry?saved.requestId:crypto.randomUUID();
  if(!retry&&!shopAvailable(d)){root.append(note('This seasonal piece returns October 1. Your owned furniture is still available.'),button('Back to catalog',back));return;}
  const draw=()=>EarnlyWorldRenderer.decorPreview(preview,{...d,color:selectedColor||d.color});
  root.append(preview,el('h3','',d.name),note('Price: '+d.price+' Arcade Coins. This purchase adds one decor item to your Backpack.'));
  const balance=Number(bootstrap.balance),price=Number(d.price),shortfall=Math.max(0,price-balance);
  if(!retry&&connected&&Number.isFinite(balance))root.append(note('Your balance: '+balance.toLocaleString()+' Arcade Coins'),note(shortfall?'You need '+shortfall.toLocaleString()+' more Arcade Coins.':'After purchase: '+(balance-price).toLocaleString()+' Arcade Coins'));
  furnitureColorPicker(root,d,selectedColor,color=>{selectedColor=color;draw();},!!retry);draw();
  if(retry)root.append(note('Confirming your previous purchase with its selected color. You will only be charged once.'));
  const buy=button('Buy for ◇ '+d.price,async()=>{
   if(!saved&&!shopAvailable(d))throw new Error('This seasonal piece returns October 1.');
   if(saved&&saved.definitionId!==d.id)throw new Error('Reopen your previous item to confirm its purchase first.');
   const purchase={definitionId:d.id,requestId,color:selectedColor,expectedPrice:retry?saved?.expectedPrice??Number(d.price):Number(d.price)};localStorage.setItem(purchaseKey,JSON.stringify(purchase));saved=purchase;
   for(const b of root.querySelectorAll('.furniture-swatch'))b.disabled=true;
   try{await action('buy',purchase);}catch(error){
    if(error.definite){localStorage.removeItem(purchaseKey);saved=null;for(const b of root.querySelectorAll('.furniture-swatch'))b.disabled=false;
     if(error.message.startsWith('Price changed.')){await refresh();const current=bootstrap.catalog.find(item=>item.id===d.id);if(current){showBuy(current,selectedColor,back);toast('Price updated. Review the new price before buying.');return;}}
    }throw error;
   }
   localStorage.removeItem(purchaseKey);await refresh();toast(d.name+' added to your Backpack');back();
  },'primary');buy.disabled=!retry&&shortfall>0;root.append(buy);if(!retry&&shortfall>0)root.append(wishlistButton(d));root.append(button('Back to catalog',back));
 }

 let backpackView={};
 function showBackpack(){
  currentPanel='backpack';const root=openPanel('Your Backpack');
  if(!connected){root.append(note('Your purchased and collected decor will be stored here. Sign in and connect to begin your collection.'),button('Connect to World',()=>connect(),'primary'));return;}
  if(bootstrap.personalPets&&bootstrap.petsEnabled)root.append(petTabs(false));
  if(backpackView.userId!==userId)backpackView={userId,search:'',location:'all',sort:'stored',scroll:0};
  const locationOf=item=>!item.room_id?'stored':item.room_id===scene.roomId?'here':'elsewhere';
  const entries=bootstrap.items.map(item=>{
   const d=bootstrap.catalog.find(d=>d.id===item.definition_id);if(!d)return null;
   const room=bootstrap.rooms.find(r=>r.id===item.room_id),location=locationOf(item),roomName=location==='here'?scene.name:room?.name||'Another room';
   const color=item.color?(EarnlyWorldCollections.furnitureColors.find(c=>c.color===item.color)?.name||'Selected'):'Original';
   return {item,d,room,location,roomName,color,search:[d.name,d.category,color,item.serial,item.room_id?roomName:'Backpack'].filter(v=>v!=null).join(' ').toLowerCase()};
  }).filter(Boolean);
  if(!entries.length){root.append(el('h3','','Your room starts with one piece'),note('Your Backpack is empty. Furniture you buy appears here, ready to place in your room.'),button('Choose my first piece',startGuidedDecorating,'primary'));const earn=el('a','daily-game-link','Play games to earn coins ↗');earn.href='games.html';earn.target='_blank';earn.rel='noopener';root.append(earn,note('Games open in a new tab. Come back to World when you’re ready to decorate.'));return;}
  const stored=entries.filter(e=>e.location==='stored').length;
  root.append(el('p','backpack-summary',entries.length+' pieces · '+stored+' ready to place'),note(scene.ownerId===userId?'Place a stored piece, or pick up furniture to use it again.':'Visit your own room to place or pick up furniture.'));
  const tools=el('div','backpack-tools'),search=el('input'),filter=el('select'),sort=el('select');
  search.type='search';search.placeholder='Name, room, collection or color';search.setAttribute('aria-label','Find your furniture');search.value=backpackView.search;
  filter.setAttribute('aria-label','Furniture location');
  for(const [value,label]of [['all','All furniture'],['stored','In Backpack'],['here','In this room'],['elsewhere','In another room']]){const option=el('option','',label+' · '+(value==='all'?entries.length:entries.filter(e=>e.location===value).length));option.value=value;filter.append(option);}filter.value=backpackView.location;
  sort.setAttribute('aria-label','Sort your furniture');for(const [value,label]of [['stored','Ready to place first'],['name','Name: A–Z']]){const option=el('option','',label);option.value=value;sort.append(option);}sort.value=backpackView.sort;
  tools.append(search,filter,sort);root.append(tools);
  const status=el('p','backpack-results'),reset=button('Clear filters',()=>{search.value='';filter.value='all';sort.value='stored';draw();}),grid=el('div','catalog-grid backpack-grid'),empty=note('');status.setAttribute('role','status');root.append(status,reset,grid,empty);
  const remember=()=>{backpackView={userId,search:search.value,location:filter.value,sort:sort.value,scroll:$('worldPanel').scrollTop};};
  const draw=()=>{
   remember();grid.replaceChildren();let matches=entries.filter(e=>e.search.includes(search.value.trim().toLowerCase())&&(filter.value==='all'||e.location===filter.value));
   matches.sort((a,b)=>(sort.value==='stored'?Number(a.location!=='stored')-Number(b.location!=='stored'):0)||a.d.name.localeCompare(b.d.name)||Number(a.item.serial)-Number(b.item.serial));
   status.textContent=matches.length+' of '+entries.length+' pieces';reset.hidden=!search.value&&filter.value==='all';empty.hidden=matches.length>0;
   empty.textContent=entries.length?'No furniture matches. Try another name or location.':'Your Backpack is empty. Find your first piece in the Catalog.';
   for(const {item,d,room,location,roomName,color}of matches){
    const card=el('article','item-card backpack-card'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,{...d,color:item.color||d.color});canvas.setAttribute('role','img');canvas.setAttribute('aria-label',d.name+' · '+color+' color');
    card.append(el('p','backpack-location '+location,location==='stored'?'In Backpack':location==='here'?'In this room':'In another room'),canvas,el('h3','',d.name));
    if(item.room_id)card.append(el('p','backpack-room',roomName));
    card.append(el('p','backpack-detail','No. '+item.serial+' · '+d.width+' × '+d.length+' tiles'));
    if(item.color)card.append(el('p','furniture-color-label',color+' color'));
    if(location==='elsewhere'){
     if(room?.ownerId===userId)card.append(button('Visit '+room.name,()=>{remember();return connect(room.id);},'primary'));
     card.append(note('Pick it up in that room to use it elsewhere.'));
    }else if(scene.ownerId===userId){
     card.append(button(location==='here'?'Move':'Place',()=>{remember();beginPlacement(item,d.name);},'primary'));
     if(location==='here')card.append(button('Pick up',async()=>{remember();await action('place',{itemId:item.id,pickup:true});await refresh();showBackpack();}));
    }else card.append(button('Go home to place',()=>{remember();return connect('choose-home');},'primary'));
    grid.append(card);
   }
  };
  const savedScroll=backpackView.scroll||0;search.oninput=draw;filter.onchange=draw;sort.onchange=draw;draw();
  root.append(button('Browse Catalog',()=>showCatalog(),'backpack-catalog'));
  requestAnimationFrame(()=>{if(currentPanel==='backpack')$('worldPanel').scrollTop=savedScroll;});
 }
 function petTabs(selected){const tabs=el('div','filters');tabs.setAttribute('aria-label','Backpack sections');for(const [label,active,fn] of [['Furniture',!selected,()=>showBackpack()],['Pets',selected,()=>showPets()]]){const b=button(label,fn,active?'selected':'');b.setAttribute('aria-pressed',String(active));tabs.append(b);}return tabs;}
 function showPets(shop=false){
  requireConnection();currentPanel='backpack';const root=openPanel(shop?'Pet Shop':'Your Pets');
  const nav=el('nav','shop-nav');nav.setAttribute('aria-label','Pet sections');for(const [label,active,fn]of [['Furniture',false,()=>shop?showCatalog():showBackpack()],['Pet Shop',shop,()=>showPets(true)],['My pets',!shop,()=>showPets(false)]]){const tab=button(label,fn,active?'selected':'');tab.setAttribute('aria-pressed',String(active));nav.append(tab);}$('worldPanel').classList.add('shop-panel');root.classList.add('pet-content');const accessories=el('div','pet-accessories');accessories.append(button('Pet beds',()=>showCatalog('Pet Comfort')),button('Toys',()=>showCatalog('Pet Toys')));root.append(nav,accessories,note(shop?'Choose a companion. Yours to keep.':'Your companions · Up to 3 in each room.'));
  const grid=el('div','catalog-grid pet-grid');root.append(grid);
  const pets=bootstrap.pets||[],catalog=bootstrap.petCatalog||[],here=pets.filter(p=>p.room_id===scene.roomId);
  for(const item of shop?catalog:pets){
   const d=shop?item:catalog.find(d=>d.id===item.species);if(!d)continue;
   const card=el('article','item-card pet-card'),canvas=el('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',d.name);EarnlyWorldRenderer.petPreview(canvas,{species:d.id,color:d.color});
   card.append(canvas,el('h3','',shop?d.name:item.name));if(shop)card.append(note(d.id==='dog'?'A loyal little tail-wagger':d.id==='cat'?'A curious, quiet companion':'A gentle, bright-eyed friend'));
   if(shop){card.append(note(d.price+' Arcade Coins'),button('Adopt '+d.name,()=>showPetBuy(d),'primary'));}
   else{
    const room=bootstrap.rooms.find(r=>r.id===item.room_id),elsewhere=item.room_id&&item.room_id!==scene.roomId;
    card.append(note(!item.room_id?'In Backpack':item.room_id===scene.roomId?'Roaming in this room':room?.name||'In another room'));
    if(elsewhere){if(room)card.append(button('Visit '+room.name,()=>connect(room.id)));}
    else{
     if(item.room_id)card.append(button('Return to Backpack',async()=>{await action('pet_pickup',{petId:item.id});await refresh();showPets();toast(item.name+' is safely in your Backpack');}));
     else{const place=button('Place in room',async()=>{await action('pet_place',{petId:item.id});await refresh();$('worldPanel').close();toast(item.name+' is exploring your room');},'primary');place.disabled=scene.ownerId!==userId||here.length>=3;card.append(place);if(scene.ownerId!==userId)card.append(note('Enter your own room to place a pet.'));else if(here.length>=3)card.append(note('3 pets are already roaming here.'));}
     card.append(button('Rename',()=>showPetRename(item)));
    }
   }
   grid.append(card);
  }
  if(!shop&&!pets.length)root.append(note('Your first companion is waiting in the Pet Shop.'));
 }
 function showPetBuy(d){
  const key='earnlyWorldPendingPet:'+userId;let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  if(saved&&saved.species!==d.id){const other=(bootstrap.petCatalog||[]).find(p=>p.id===saved.species);if(other){showPetBuy(other);toast('Resolve your previous pet purchase first.');return;}throw new Error('A pet purchase needs confirmation. Reconnect and try again.');}
  const purchase=saved||{species:d.id,requestId:crypto.randomUUID()},root=openPanel('Adopt '+d.name+'?'),canvas=el('canvas','pet-purchase-preview');EarnlyWorldRenderer.petPreview(canvas,{species:d.id,color:d.color});
  root.append(canvas,note(d.price+' Arcade Coins · One permanent pet, stored in Backpack.'),note('Name your pet after adoption. No feeding fees.'));
  if(saved)root.append(note('Confirming your previous request will not charge twice.'));
  root.append(button(saved?'Confirm previous adoption':'Adopt for '+d.price+' Coins',async()=>{
   localStorage.setItem(key,JSON.stringify(purchase));
   try{await action('pet_buy',purchase);}catch(error){if(error.definite)localStorage.removeItem(key);throw error;}
   localStorage.removeItem(key);await refresh();showPets();toast(d.name+' joined your Backpack');
  },'primary'),button('Back to pets',()=>showPets(true)));
 }
 function showPetRename(pet){
  const root=openPanel('Name your pet'),label=el('label','','Pet name'),input=el('input');input.value=pet.name;input.maxLength=18;input.setAttribute('aria-label','Pet name');label.append(input);root.append(label,note('1–18 letters or numbers. Spaces, apostrophes and hyphens are welcome.'));
  root.append(button('Save name',async()=>{const name=input.value.trim();if(!/^[A-Za-z0-9][A-Za-z0-9 '-]{0,17}$/.test(name))throw new Error('Choose a name with 1–18 letters or numbers.');await action('pet_rename',{petId:pet.id,name});await refresh();showPets();toast('Pet name saved');},'primary'),button('Back to pets',()=>showPets()));
 }
 const hangoutStyles={
  'Earnly Plaza':{theme:'plaza',tag:'MEET & PLAY',description:'Meet other players, chat and play together.',color:'#74f3d0',previewIds:['mint-sofa','arcade-cabinet','fern','low-table']},
  'Hotel Lobby':{theme:'lobby',collection:'Bramble Cafe',tag:'COFFEE & COMPANY',description:'Coffee, cozy seats and a welcome from Pip.',host:'Pip',color:'#dcad79'},
  'Rooftop Lounge':{theme:'rooftop',collection:'Morrow Lounge',tag:'ABOVE THE CITY',description:'City views and mocktails with Remy.',host:'Remy',color:'#b39bd9'},
  'Patio Hangout':{theme:'patio',collection:'Dewglass Garden',tag:'YOUR LITTLE GREEN ESCAPE',description:'Relax in the garden with Fern.',host:'Fern',color:'#8dc7b1'}
 };
 function hangoutStyle(room){return room?.ownerId===null?hangoutStyles[room.name]:null;}
 function hangoutPreview(card,style){
  const set=EarnlyWorldCollections.collections.find(c=>c.name===style.collection),canvas=el('canvas','hangout-preview');
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',(style.previewIds?'Earnly Plaza':style.collection)+' room preview');
  EarnlyWorldRenderer.roomThumbnail(canvas,Array(6).fill('000000').join('\n'),EarnlyWorldCollections.vignette(style.previewIds?{previewIds:style.previewIds}:set,style.previewIds?demoCatalog:undefined),style.theme);
  card.style.setProperty('--hangout-accent',style.color);card.append(canvas,el('p','hangout-tag',style.tag));
 }
 function findHangoutSeat(){
  requireConnection();const occupied=new Set([...renderer.users.values(),...renderer.staff.values()].map(u=>u.position.x+','+u.position.y));
  const me=renderer.users.get(userId)?.position||{x:0,y:0};
  const seats=(scene.items||[]).filter(item=>{if(!item.canSit)return false;const turn=item.rotation===2||item.rotation===6,w=turn?item.length:item.width,h=turn?item.width:item.length;for(let y=item.y;y<item.y+h;y++)for(let x=item.x;x<item.x+w;x++)if(!occupied.has(x+','+y))return true;return false;});
  seats.sort((a,b)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y));
  if(!seats.length)throw new Error('All seats are taken. Stay a while or try another hangout.');useSeat(seats[0]);
 }
 function showRooms(initialTab='mine'){currentPanel='rooms';const root=openPanel('Rooms');if(needsFirstRoom){showRoomCreator(true);return;}if(!connected){root.append(note('The plaza is a shared hangout. Personal rooms will let you decorate, invite friends, and show off your collection.'),button('Connect to World',()=>connect()));return;}
  let selected=['mine','public','explore'].includes(initialTab)?initialTab:'mine',limit=12,explore=[],nextOffset=null,query='',request=0;
  const tabs=el('div','room-browser-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Room categories');
  const search=el('input','room-browser-search');search.type='search';search.placeholder='Room name or owner';search.setAttribute('aria-label','Search rooms by name or owner');search.maxLength=80;
  const intro=el('p','room-browser-intro'),management=el('div','room-browser-management');
  const list=el('div','room-directory'),status=el('p','room-browser-status');status.setAttribute('role','status');
  const more=button('Load more',()=>{if(selected==='explore')loadExplore(true);else{limit+=12;draw(bootstrap.rooms);}});
  const tabButtons=[];
  const ownerName=r=>r.ownerUsername||bootstrap.friends.find(f=>f.userId===r.ownerId)?.username||'Player';
  const draw=rooms=>{
   management.hidden=selected!=='mine';intro.textContent=selected==='mine'?'Your spaces to decorate and share.':selected==='public'?'Everyone is welcome. Pick a place to hang out.':'Visit rooms created by other players.';
   search.hidden=selected!=='explore';tabButtons.forEach(([key,b])=>b.setAttribute('aria-pressed',String(key===selected)));
   let visible=selected==='explore'?explore:activeRoomsFirst(rooms.filter(r=>selected==='mine'?r.ownerId===userId:r.ownerId===null));
   more.hidden=selected==='explore'?nextOffset===null:visible.length<=limit;
   if(selected!=='explore')visible=visible.slice(0,limit);
   list.replaceChildren();
   if(!visible.length)list.append(note(selected==='mine'?'Your rooms appear here. Create your first room below.':selected==='explore'?'No public player rooms found. Try another room name or owner.':'No public hangouts available.'));
   for(const r of visible){const style=hangoutStyle(r),card=el('section','room-card room-browser-card'+(style?' hangout-card':''));if(style)hangoutPreview(card,style);
    card.append(row(r.name,[button(r.ownerId===userId?'My room →':'Visit →',()=>connect(r.id))]),roomCount(r));
    if(r.ownerId!==null)card.append(note(r.ownerId===userId?'Owned by you':'Owned by '+ownerName(r)));
    if(style)card.append(note(style.description));
    if(r.ownerId===userId)card.append(button('Rename room',()=>showRenameRoom(r),'room-rename'),button('Delete room',()=>showDeleteRoom(r),'room-delete'));list.append(card);
   }
  };
  const loadExplore=async(append=false)=>{
   const ticket=++request;status.textContent='Finding rooms…';more.disabled=true;
   try{const result=await action('room_explore',{query,offset:append?nextOffset:0});
    if(ticket!==request||version!==panelVersion||selected!=='explore')return;
    if(!Array.isArray(result?.rooms))throw new Error('Directory unavailable');
    explore=append?[...explore,...result.rooms.filter(r=>!explore.some(e=>e.id===r.id))]:result.rooms;nextOffset=result.nextOffset??null;status.textContent='';draw(bootstrap.rooms);
   }catch(e){if(ticket===request&&version===panelVersion)status.textContent='Rooms unavailable. Tap Refresh rooms to retry.';}
   finally{if(ticket===request)more.disabled=false;}
  };
  for(const [key,label] of [['mine','My Rooms'],['public','Public Hangouts'],['explore','Explore']]){const b=button(label,()=>{selected=key;limit=12;request++;more.disabled=false;status.textContent='';draw(bootstrap.rooms);if(key==='explore')loadExplore();});tabButtons.push([key,b]);tabs.append(b);}
  let searchTimer;search.oninput=()=>{query=search.value.trim();request++;explore=[];nextOffset=null;draw(bootstrap.rooms);status.textContent='Finding rooms…';clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(version===panelVersion&&selected==='explore')loadExplore();},250);};
  root.append(tabs,intro,search,status,list,more);
  draw(bootstrap.rooms);const version=panelVersion;
  const update=async()=>{for(const b of root.querySelectorAll('button'))b.disabled=true;try{const rooms=await action('room_directory');if(version===panelVersion&&$('worldPanel').open&&Array.isArray(rooms)){bootstrap.rooms=rooms;draw(rooms);}}catch(e){if(version===panelVersion)toast('Room counts unavailable. Try Refresh rooms.');}finally{if(version===panelVersion)for(const b of root.querySelectorAll('button'))b.disabled=false;}};
  root.append(button('Refresh rooms',()=>selected==='explore'?loadExplore():update(),'room-refresh'));root.append(management);
  management.append(button('＋ Create room · Free',()=>showRoomCreator(false),'primary'),note('New rooms are open to visitors. You can make yours private.'));
  if(scene.ownerId===userId)management.append(note('Visitors for '+scene.name+': '+(scene.access==='open'?'Allowed':'Private')),button(scene.access==='open'?'Make this room private':'Allow visitors',async()=>{const access=scene.access==='open'?'closed':'open';await action('room_access',{roomId:scene.roomId,access});scene.access=access;await refresh();showRooms();}));
  update();if(selected==='explore')loadExplore();
 }
 function showRenameRoom(room){
  if(room.ownerId!==userId)return;
  const root=openPanel('Rename room'),input=el('input'),label=el('label','room-name-label','Room name');
  input.id='renameRoomName';input.maxLength=40;input.value=room.name;input.autocomplete='off';label.htmlFor=input.id;
  const status=el('p','room-browser-status');status.setAttribute('role','status');
  const cancel=button('Cancel',showRooms),save=button('Save name',async()=>{
   const name=input.value.trim();if(!name||[...name].length>40||/[\x00-\x1f\x7f]/.test(name)){status.textContent='Use 1–40 characters, without line breaks.';input.focus();return;}
   cancel.disabled=true;input.disabled=true;status.textContent='Saving…';
   try{const result=await action('rename_room',{roomId:room.id,name});
    for(const r of bootstrap.rooms)if(r.id===room.id)r.name=result.name;
    if(scene.roomId===room.id){scene.name=result.name;$('roomName').textContent=result.name;}
    showRooms();toast('Room name saved');
   }catch(e){status.textContent=e.message||'Could not save. Try again.';}
   finally{cancel.disabled=false;input.disabled=false;}
  },'primary');
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(!save.disabled)save.click();}};
  root.append(label,input,note('You can change this anytime. Your furniture and room link stay the same.'),status,save,cancel);input.focus();input.select();
 }
 $('renameRoom').onclick=()=>showRenameRoom({id:scene.roomId,name:scene.name,ownerId:scene.ownerId});
 function showDeleteRoom(room){
  if(room.ownerId!==userId)return;
  const root=openPanel('Delete this room?');
  root.append(el('h3','',room.name),note('This permanently deletes this room and its room chat. All furniture returns to your Backpack. Your coins and purchases are kept. This cannot be undone.'),note('If you are inside, you will move to the plaza. Visitors must leave before the room can be deleted.'));
  const cancel=button('Keep room',showRooms),remove=button('Yes, delete room',async()=>{
   cancel.disabled=true;
   try{await action('delete_room',{roomId:room.id,confirm:true});
    if(scene.roomId===room.id){$('worldPanel').close();await connect('plaza');}
    else{await refresh();showRooms();}
    toast('Room deleted · Furniture saved in your Backpack');
   }finally{cancel.disabled=false;}
  },'danger');
  root.append(cancel,remove);cancel.focus();
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
  update();root.append(grid);if(!first)root.append(label,input);root.append(create,note('Public by default. Make it private anytime from Rooms.'));
  if(!first)root.append(button('Back to rooms',showRooms));
 }
 async function showStaff(staff){
  if(staff.isAI)return showResident(staff.residentId);
  const roomId=scene.roomId,version=panelVersion,reply=await action('staff_talk',{staffId:staff.staffId});
  if(scene.roomId!==roomId||version!==panelVersion)return;
  currentPanel='staff';const root=openPanel(staff.species?reply.name:reply.name+' · '+reply.role),style=hangoutStyle(scene);
  if(staff.species&&bootstrap.petInteractions){
   const canvas=el('canvas','pet-purchase-preview');canvas.setAttribute('aria-label',reply.name);EarnlyWorldRenderer.petPreview(canvas,staff);root.append(canvas,note('Room companion · '+staff.species));
   const controls=el('div','pet-interactions');let busy=false;
   const interact=async kind=>{if(busy)return;busy=true;for(const b of controls.children)b.disabled=true;try{const result=await action('pet_interact',{staffId:staff.staffId,kind});if(scene.roomId===roomId){$('worldPanel').close();toast(result.message);}}finally{busy=false;for(const b of controls.children)b.disabled=false;pet.disabled=!reply.canPet;}};
   const pet=button('Pet',()=>interact('pet'),'primary');pet.disabled=!reply.canPet;controls.append(pet);
   if(reply.canCall)controls.append(button('Call over',()=>interact('call'),'primary'));
   root.append(controls);if(!reply.canPet)root.append(note(reply.canCall?'Call your pet over, then tap it to give it some love.':'Walk beside this companion to pet it.'));
   if(staff.petId&&staff.ownerId===userId)root.append(button('Manage my pets',()=>showPets()));
   root.append(button('Back to room',()=>$('worldPanel').close()));return;
  }
  root.append(note(staff.species?'Room companion · '+staff.species:'Staff NPC · Your hangout host'),el('p','staff-greeting',reply.greeting));
  const response=el('p','staff-greeting staff-reply');response.hidden=true;response.setAttribute('aria-live','polite');
  root.append(button(staff.species?'About this companion':reply.role==='Bartender'?'See the mocktail menu':'Ask for a local tip',()=>{response.textContent=reply.tip;response.hidden=false;}),response);
  if(staff.petId&&staff.ownerId===userId)root.append(button('Manage my pets',()=>showPets(),'primary'));
  root.append(button('Find me a seat',findHangoutSeat,'primary'));
  if(style)root.append(button('Browse '+style.collection,()=>showCatalog(style.collection)));
  root.append(button('Explore other rooms',()=>showRooms('explore')));
 }
 let residentQuiet=false;
 function showResidents(){
  const root=openPanel('Spud residents');root.append(note('Tap a resident nearby to chat. Natural: occasional private greetings. Quiet: greetings only when you start the conversation.'));
  root.append(button(residentQuiet?'Switch to Natural mode':'Switch to Quiet mode',async()=>{const result=await action('resident_mode',{quiet:!residentQuiet});residentQuiet=result.quiet;if(residentQuiet)for(const [id,b] of renderer.bubbles)if(b.mode==='ai')renderer.bubbles.delete(id);showResidents();}));
  if(bootstrap.aiMemory)root.append(button('Resident friends & privacy',showResidentMemory));
  if(![...renderer.staff.values()].some(s=>s.isAI))root.append(note('Meet the residents in a public hangout.'),button('Visit a hangout',()=>showRooms('public'),'primary'));
  for(const s of renderer.staff.values())if(s.isAI){const controls=[button('Chat',()=>showResident(s.residentId))];if(s.invitedBy===userId)controls.push(button('Dismiss',async()=>{await action('resident_dismiss',{residentId:s.residentId});showResidents();}));root.append(row(s.username+' · '+s.activity,controls));}
 }
 function stopResidentFocus(){clearTimeout(residentFocusTimer);const focus=residentFocus;residentFocus=null;if(focus&&connected&&scene?.roomId===focus.room)action('resident_focus',{residentId:focus.id,active:false}).catch(()=>{});}
 async function focusResident(focus){
  try{const state=await action('resident_focus',{residentId:focus.id,active:true});
   if(residentFocus!==focus||focus.version!==panelVersion||!$('worldPanel').open||scene.roomId!==focus.room){if(connected&&scene.roomId===focus.room&&!(residentFocus?.id===focus.id&&residentFocus.room===focus.room))action('resident_focus',{residentId:focus.id,active:false}).catch(()=>{});return;}
   for(const b of $('panelContent').querySelectorAll('[data-resident-topic]'))b.disabled=!state.ready;
   focus.status.textContent=state.ready?'Ready to chat · '+focus.name+' will stay here while you talk.':'Walking over to '+focus.name+'…';
   residentFocusTimer=setTimeout(()=>{if(residentFocus===focus)focusResident(focus);},state.ready?15000:2000);
  }catch(e){if(residentFocus===focus){focus.status.textContent=e.message;stopResidentFocus();}}
 }
 async function showResident(id){
  requireConnection();const s=[...renderer.staff.values()].find(s=>s.residentId===id);if(!s)throw new Error('This AI resident is not here now');
  const root=openPanel(s.username);$('panelTitle').append(el('span','resident-ai-badge','AI resident'));const portrait=el('canvas','resident-portrait');portrait.setAttribute('role','img');portrait.setAttribute('aria-label',s.username+' avatar');root.append(portrait,note(s.role.replace(' · AI resident','')),note('Private conversation · Preset replies'));EarnlyWorldRenderer.spudPreview(portrait,s);
  const status=el('p','muted','Getting ready to chat…');status.setAttribute('aria-live','polite');root.append(status);const response=el('p','staff-greeting');response.setAttribute('aria-live','polite');root.append(response);
  for(const [topic,label]of [['hello','Say hello'],['games','Talk games'],['room','Talk furniture'],['joke','Tell me a joke'],['bye','See you later']]){const b=button(label,async()=>{const version=panelVersion,room=scene.roomId,reply=await action('resident_chat',{residentId:id,topic});if(version===panelVersion&&scene.roomId===room)response.textContent=reply.text;});b.dataset.residentTopic=topic;b.disabled=true;root.append(b);}
  if(bootstrap.aiMemory){const games=el('select');games.setAttribute('aria-label','Favorite game to remember');for(const name of ['Snake','Bubble Pop','Tap Rush','Neon Slice','Coin Catch']){const opt=el('option','',name);opt.value=name;games.append(opt);}const share=button('Share my favorite game',async()=>{const version=panelVersion,reply=await action('resident_chat',{residentId:id,topic:'games',favoriteGame:games.value});if(version===panelVersion)response.textContent=reply.text+' Saved only when memory is on.';});share.dataset.residentTopic='games';share.disabled=true;root.append(games,share);}
  if(bootstrap.aiMemory)root.append(button('Friendship & saved memories',()=>showResidentMemory(id)));
  if(s.invitedBy===userId)root.append(button('Dismiss visitor',async()=>{await action('resident_dismiss',{residentId:id});$('worldPanel').close();toast(s.username+' headed back to the hangouts');}));
  root.append(button('Social settings',showResidents),button('Back to room',()=>$('worldPanel').close()));
  residentFocus={id,name:s.username,room:scene.roomId,version:panelVersion,status};focusResident(residentFocus);
 }
 async function showResidentMemory(selected){
  requireConnection();const version=panelVersion,room=scene.roomId,state=await action('resident_memory');if(version!==panelVersion||scene.roomId!==room)return;const root=openPanel('Resident friends & privacy');residentQuiet=state.quiet;
  root.append(note('AI friends are automated characters, separate from real players.'),note('Memory is '+(state.remember?'on':'off')+'. When on, residents save conversation topics, your selected favorite game, rooms you chat in and your own verified game scores. No raw conversation transcripts are saved or sent to an external AI service. Invite one AI friend at a time into your own room for up to 10 minutes; they leave when you dismiss them or leave the room. Turning memory off erases saved facts and keeps friendships.'));
  root.append(button(state.remember?'Turn memory off & erase saved facts':'Turn memory on',async()=>{await action('resident_settings',{remember:!state.remember});showResidentMemory(selected);}));
  const known=new Map((state.relations||[]).map(r=>[r.residentId,r]));for(const s of renderer.staff.values())if(s.isAI&&!known.has(s.residentId))known.set(s.residentId,{residentId:s.residentId,friend:false});
  for(const m of known.values()){if(typeof selected==='string'&&m.residentId!==selected)continue;const name=[...renderer.staff.values()].find(s=>s.residentId===m.residentId)?.username||bootstrap.residentCatalog?.find(s=>s.id===m.residentId)?.name||m.residentId;const card=el('section','friend-card');card.append(el('h3','',name+(m.friend?' · Friend':'')),el('span','resident-ai-badge','AI resident'),note('Topics: '+(m.topics?.join(', ')||'None')+' · Favorite game: '+(m.favoriteGame||'None')),note('Saved visits: '+(m.roomVisits?.length||0)+' · Remembered sessions: '+(m.visits||0)),note('Rooms: '+(m.roomVisits?.map(id=>bootstrap.rooms.find(r=>r.id===id)?.name||id).join(', ')||'None')),note('Scores: '+(m.achievements?.map(a=>a.game+' '+a.score).join(', ')||'None')));
   card.append(button(m.friend?'Remove friend':'Add friend',async()=>{await action('resident_friend',{residentId:m.residentId,friend:!m.friend});showResidentMemory(selected);}));
   if(m.friend&&scene.ownerId===userId){const visiting=[...renderer.staff.values()].find(s=>s.invitedBy===userId);card.append(button(visiting?.residentId===m.residentId?'Dismiss visitor':'Invite to this room',async()=>{await action(visiting?.residentId===m.residentId?'resident_dismiss':'resident_invite',{residentId:m.residentId});showResidentMemory(selected);}));}
   if(state.remember)card.append(button('Forget '+name+' memories',async()=>{await action('resident_forget',{residentId:m.residentId});showResidentMemory(selected);}));root.append(card);
  }
  if(state.remember)root.append(button('Forget all memories & turn memory off',async()=>{await action('resident_forget');showResidentMemory(selected);}));
  root.append(button('Back to residents',showResidents));
 }
 function showStaffList(){currentPanel='staff';const root=openPanel('Staff & animals');if(bootstrap.aiResidents)root.append(button('Meet the residents',showResidents,'primary'));if(!connected){root.append(note('Connect to World to meet the room staff.'));return;}for(const staff of renderer.staff.values())root.append(row(staff.username+' · '+(staff.isAI?staff.role.replace(' · AI resident',''):staff.role),[button(staff.isAI?'Meet resident':staff.species?'Meet pet':'Say hello',()=>showStaff(staff))]));if(!renderer.staff.size)root.append(note('No staff in this room. Visit the Hotel Lobby, Rooftop Lounge or Patio Hangout.'));}
 const friendBrowser={query:'',filter:'all'};
 function showFriends(){
  currentPanel='friends';const root=openPanel('Friends'),version=panelVersion;
  if(!connected){root.append(note('Connect to World to visit friends and send messages.'),button('Connect to World',()=>connect(),'primary'));return;}
  if(bootstrap.aiMemory)root.append(button('Resident friends & privacy',showResidentMemory));
  const friends=bootstrap.friends||[],accepted=friends.filter(f=>f.accepted),requests=friends.filter(f=>!f.accepted);
  const summary=el('p','friends-summary',`${accepted.filter(f=>f.online).length} online · ${accepted.length} friends`);
  const search=el('input','friends-search');search.type='search';search.placeholder='Find a friend';search.setAttribute('aria-label','Find a friend');search.maxLength=18;search.value=friendBrowser.query;
  const tabs=el('div','friends-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Friend filters');
  const list=el('div','friends-list'),status=el('p','friends-results');status.setAttribute('role','status');
  const filters=[['all','All'],['online','Online'],['requests',`Requests (${requests.length})`]],tabButtons=[];
  const redraw=()=>{
   tabButtons.forEach(([key,b])=>b.setAttribute('aria-pressed',String(friendBrowser.filter===key)));
   const query=friendBrowser.query.trim().toLowerCase();
   const visible=friends.filter(f=>(friendBrowser.filter==='requests'?!f.accepted:friendBrowser.filter==='online'?f.accepted&&f.online:f.accepted)&&f.username.toLowerCase().includes(query)).sort((a,b)=>Number(!!b.online)-Number(!!a.online)||a.username.localeCompare(b.username));
   list.replaceChildren();status.textContent=visible.length+' '+(friendBrowser.filter==='requests'?'requests':'friends')+(query?' found':'');
   if(!visible.length)list.append(note(query?'No matching friends. Try another name.':friendBrowser.filter==='online'?'No friends online right now. You can still visit their open rooms from All.':friendBrowser.filter==='requests'?'No pending requests.':'Add a friend below to visit their rooms.'));
   if(!visible.length&&!query&&friendBrowser.filter==='all'&&!accepted.length){list.append(note('Meet players in a public hangout. Tap a player to open their profile and send a friend request.'),button('Visit plaza',()=>connect('plaza'),'primary'));}
   if(!visible.length&&!query&&friendBrowser.filter==='online'&&accepted.length)list.append(button('Show all friends',()=>{friendBrowser.filter='all';redraw();}));
   for(const f of visible){
    const card=el('section','friend-card'),heading=el('div','friend-heading'),avatar=el('span','friend-initial',f.username.slice(0,1).toUpperCase()),identity=el('div');avatar.setAttribute('aria-hidden','true');
    identity.append(el('h3','',f.username),el('p','friend-presence'+(f.accepted&&f.online?' is-online':''),f.accepted?(f.online?'Online':'Offline'):f.incoming?'Wants to be your friend':'Request sent'));
    heading.append(avatar,identity);card.append(heading);
    const actions=el('div','friend-actions');
    if(f.accepted){
     actions.append(button('Visit rooms',()=>showFriendRooms(f),'primary'),button('Message',()=>showPrivate(f)));
     if(bootstrap.socialDiscovery)actions.append(button('Invite here',()=>sendRoomInvite(f)));
     const more=el('details','friend-options');more.append(el('summary','','Manage friend'),button('Remove friend',()=>showRemoveFriend(f)));card.append(actions,more);
    }else if(f.incoming){actions.append(button('Accept request',async()=>{await action('friend_accept',{userId:f.userId});await refresh();if(version===panelVersion&&$('worldPanel').open)showFriends();},'primary'));card.append(actions);}
    list.append(card);
   }
  };
  for(const [key,label] of filters){const b=button(label,()=>{friendBrowser.filter=key;redraw();});tabButtons.push([key,b]);tabs.append(b);}
  search.oninput=()=>{friendBrowser.query=search.value;redraw();};root.append(summary);
  if(bootstrap.socialDiscovery)root.append(button('Room invitations',showRoomInvites,'friends-invitations'));
  root.append(search,tabs,status,list);
  const add=el('section','friends-add'),form=el('form','panel-form'),input=el('input');input.placeholder='Friend’s username';input.setAttribute('aria-label','Friend’s username');input.maxLength=18;input.required=true;
  const submit=el('button','','Send request');submit.type='submit';form.append(input,submit);
  form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;try{await action('friend_request',{username:input.value.trim()});await refresh();if(version===panelVersion&&$('worldPanel').open){friendBrowser.filter='requests';friendBrowser.query='';showFriends();toast('Friend request sent');}}catch(err){toast(err.message);}finally{submit.disabled=false;}};
  add.append(el('h3','','Add a friend'),form);root.append(add,button('Refresh status',async()=>{await refresh();if(version===panelVersion&&$('worldPanel').open)showFriends();}));redraw();
 }
 function showRemoveFriend(friend){
  const root=openPanel('Remove friend?'),version=panelVersion;
  root.append(note(`Remove ${friend.username} from your friends? You can send a new request later.`),button('Keep friend',showFriends,'primary'),button('Remove friend',async()=>{await action('friend_remove',{userId:friend.userId});await refresh();if(version===panelVersion&&$('worldPanel').open){showFriends();toast('Friend removed');}}));
 }
 function activeRoomsFirst(rooms){const count=r=>Number.isInteger(r.occupancy)&&r.occupancy>=0?r.occupancy:-1;return [...rooms].sort((a,b)=>count(b)-count(a));}
 function roomCount(room){if(bootstrap.aiResidents){const total=Number.isInteger(room.spudCount)&&room.spudCount>=0?room.spudCount:Math.max(0,room.occupancy||0);return el('p','room-occupancy',total>0?total+(total===1?' Spud here':' Spuds here'):room.ownerId===null?'Resident hangout':'Open room');}const count=Number.isInteger(room.occupancy)&&room.occupancy>=0?room.occupancy:null;return el('p','room-occupancy',count===null?'Player count unavailable':`${count} ${count===1?'player':'players'} in room`);}
 async function showFriendRooms(friend){
  currentPanel='friend-rooms';const root=openPanel(friend.username+'’s rooms'),version=panelVersion;root.append(note('Loading rooms…'));
  try{const rooms=await action('friend_rooms',{userId:friend.userId});if(version!==panelVersion||!$('worldPanel').open)return;
   root.replaceChildren(note('Open rooms · Connected players only, excluding NPC staff.'));
   if(!rooms.length)root.append(note('No rooms open to visitors yet. Your friend can open a room from their Rooms menu.'));
   for(const room of activeRoomsFirst(rooms)){const card=el('section','room-card');card.append(row(room.name,[button('Enter room →',()=>connect(room.id))]),roomCount(room));root.append(card);}
   root.append(button('Refresh rooms',()=>showFriendRooms(friend)));
  }catch(e){if(version!==panelVersion||!$('worldPanel').open)return;root.replaceChildren(note('Rooms unavailable. Your friend may have changed access.'),button('Try again',()=>showFriendRooms(friend)));}
  root.append(button('Back to friends',showFriends));
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
 function showCoins(){
  currentPanel='coins';const root=openPanel('Your Arcade Coins');
  const balance=el('strong','world-wallet-balance');balance.id='worldWalletBalance';balance.textContent=connected?BigInt(bootstrap.balance||0).toLocaleString():'—';
  const buy=el('a','world-wallet-buy','Buy more coins ↗');buy.href='avatars.html#coin-shop';buy.target='_blank';buy.rel='noopener';
  const earn=el('a','world-wallet-buy','Play games to earn coins ↗');earn.href='games.html';earn.target='_blank';earn.rel='noopener';
  root.append(balance,note('Play to earn coins. Decorate your room.'),earn,note('Games open in a new tab so your room stays open.'),buy,note('The coin shop opens in a new tab. Your room stays open here.'),button('Back to room',()=>$('worldPanel').close()),note('Coins have no cash value. Purchased coins cannot be redeemed for cash or cash equivalents.'));
  if(connected)refresh().then(()=>{if(currentPanel==='coins'&&$('worldPanel').open)balance.textContent=BigInt(bootstrap.balance||0).toLocaleString();}).catch(()=>{});
  else root.append(note('Connect to World to see your saved room balance.'));
 }
 $('coinBalance').addEventListener('click',event=>{event.preventDefault();showCoins();});
 window.addEventListener('focus',()=>{if(connected)refresh().then(()=>{if(currentPanel==='coins'&&$('worldWalletBalance'))$('worldWalletBalance').textContent=BigInt(bootstrap.balance||0).toLocaleString();}).catch(()=>{});});
 const panels={staff:showStaffList,rooms:showRooms,catalog:showCatalog,backpack:showBackpack,friends:showFriends,chat:showChat};document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>panels[b.dataset.panel]());
 $('worldCanvas').onkeydown=e=>{const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(!moves[e.key])return;e.preventDefault();const u=renderer.users.get(userId);if(!u)return;const [x,y]=moves[e.key],view=renderer.toView(u.position),target=renderer.fromView({x:view.x+x,y:view.y+y});if(connected)socket.send(JSON.stringify({type:'MOVE_TO',x:target.x,y:target.y}));};
 window.addEventListener('earnly-cloud-auth-change',()=>{
  // Initial auth notifications have no private World state to erase. Keep the guest catalog open.
  if(userId==='preview'&&!connected&&!connecting)return;
  $('worldPanel').close();$('panelContent').replaceChildren();panelVersion++;renderer.bubbles.clear();residentQuiet=false;guideResumed=false;guideDecorateOnArrival=false;$('placementSuccess').hidden=true;$('firstVisitHint').hidden=true;clearTimeout(retryTimer);retryCount=0;waitingForNetwork=false;const previous=socket;socket=null;previous?.close();connected=false;finishConnecting();session=null;placing=null;showPlacement();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Your account changed. Connect again.'));}pending.clear();$('connectionStatus').textContent='Disconnected · Connect to enter your room';$('peopleCount').textContent='Room preview';entryState('Your account changed. Connect to enter your room.');});

 let guideResumed=false,guideDecorateOnArrival=false;
 const guideMemory=new Map();
 const guideSteps=[{id:'walk',title:'1 / 3 · Take a few steps',text:'Tap an empty floor tile to walk. Pinch with two fingers to zoom.',action:'Try walking',run:()=>{$('worldPanel').close();$('worldCanvas').focus({preventScroll:true});$('worldCanvas').scrollIntoView({block:'nearest'});}},
  {id:'decorate',title:'2 / 3 · Place your first piece',text:'Choose a piece, preview it on the floor, then tap Place here to save.',action:'Choose a piece',run:startGuidedDecorating},
  {id:'visit',title:'3 / 3 · Explore a hangout',text:'Visit the plaza. Your room and furniture stay saved.',action:'Visit plaza',run:()=>connect('plaza')}];
 function guideProgress(){
  if(guideMemory.has(userId))return guideMemory.get(userId);
  let saved={};try{const value=JSON.parse(localStorage.getItem('earnly.world.guide.'+userId)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))saved=value;}catch{}
  const progress=Object.fromEntries(guideSteps.map(s=>[s.id,saved[s.id]===true]));guideMemory.set(userId,progress);return progress;
 }
 function guideDismissed(){try{return localStorage.getItem('earnly.world.hint.'+userId)==='1';}catch{return false;}}
 function completeGuideStep(id){if(!connected)return;const progress=guideProgress();if(progress[id])return;progress[id]=true;try{localStorage.setItem('earnly.world.guide.'+userId,JSON.stringify(progress));}catch{}
  const finished=guideSteps.every(s=>progress[s.id]);showFirstVisitHint(finished&&(!guideDismissed()||guideResumed));
 }
 function showFirstVisitHint(force=false){
  if(!connected){$('firstVisitHint').hidden=true;return;}if(force)guideResumed=true;
  const progress=guideProgress(),step=guideSteps.find(s=>!progress[s.id]),done=guideSteps.filter(s=>progress[s.id]).length;
  $('firstVisitHint').hidden=!guideResumed&&(guideDismissed()||!step);
  $('guideStep').textContent=step?.title||'✓ You’re ready to explore';
  $('guideText').textContent=step?.text||'You walked, decorated, and visited a hangout. Check Daily missions for rewards you can claim.';
  if(step?.id==='decorate'&&scene.ownerId!==userId)$('guideText').textContent='Head to your own room to arrange your furniture.';
  $('guideAction').textContent=step?.id==='decorate'&&scene.ownerId!==userId?'Go to my room':step?.action||'Daily missions';
  $('guideAction').onclick=async()=>{const b=$('guideAction');b.disabled=true;try{await (step?.run||showDailyMissions)();}catch(e){toast(e.message);}finally{b.disabled=false;}};
  $('guideProgress').textContent=done+' of 3 complete';
  $('worldGuide').textContent=step?'Room guide · '+done+'/3':'Room guide';
 }
 async function startGuidedDecorating(){requireConnection();if(scene.ownerId!==userId){guideDecorateOnArrival=true;try{await connect('choose-home');}catch(e){guideDecorateOnArrival=false;throw e;}return;}showFirstPiece();}
 function previewFirstPiece(){
  // Start on a real, clear footprint, including split-level rooms. Nothing is saved yet.
  const rows=scene.heightmap.split('\n'),candidates=[];
  for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++)if(rows[y][x]!=='x')candidates.push({x,y});
  candidates.sort((a,b)=>Math.hypot(a.x-rows[0].length/2,a.y-rows.length/2)-Math.hypot(b.x-rows[0].length/2,b.y-rows.length/2));
  for(const tile of candidates){renderer.placement={item:placing,...tile,rotation,explicitConfirm:true};if(renderer.placementResult().valid)return;}
  renderer.clearPlacement();
 }
 function showFirstPiece(){
  requireConnection();if(scene.ownerId!==userId){startGuidedDecorating().catch(e=>toast(e.message));return;}
  currentPanel='first-piece';const root=openPanel('Make this room yours');
  const owned=bootstrap.items.filter(i=>(!i.room_id||i.room_id===scene.roomId)&&bootstrap.catalog.some(d=>d.id===i.definition_id)).sort((a,b)=>Number(!!a.room_id)-Number(!!b.room_id));
  root.append(note(owned.length?'1. Choose an owned piece. 2. Tap the floor to preview. 3. Tap Place here to save.':'Your Backpack is empty. You can earn coins in the arcade or choose a piece from the Catalog.'));
  const grid=el('div','catalog-grid guide-piece-grid');
  for(const item of owned.slice(0,4)){const d=bootstrap.catalog.find(d=>d.id===item.definition_id),card=el('article','item-card'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,{...d,color:item.color||d.color});card.append(canvas,el('h3','',d.name),el('p','owned-label',item.room_id?'Already in this room · Move it to try decorating':'Already yours · No coins needed'),button(item.room_id?'Move this piece':'Place this piece',()=>{beginPlacement({...d,...item,sprite:d.sprite_id,itemHeight:Number(d.item_height),walkable:d.walkable===true,canStack:d.can_stack===true,canSit:d.can_sit===true,canLay:d.can_lay===true},d.name);placing.guided=true;previewFirstPiece();showPlacement();},'primary'));grid.append(card);}
  if(owned.length)root.append(grid,button('See all my furniture',showBackpack));
  else if(bootstrap.items.length)root.append(note('You have furniture in another room. Find it in your Backpack.'),button('Find my furniture',showBackpack,'primary'));
  else {const options=bootstrap.catalog.filter(d=>shopAvailable(d)&&!d.vip_only&&(!d.supply_limit||d.minted<d.supply_limit)).sort((a,b)=>Number(a.price)-Number(b.price)).slice(0,3);
   for(const d of options){const card=el('article','item-card'),canvas=el('canvas');EarnlyWorldRenderer.thumbnail(canvas,d);card.append(canvas,el('h3','',d.name),note(Number(d.price).toLocaleString()+' Arcade Coins'));
    const buy=button('Choose this piece',()=>showBuy(d,null,showFirstPiece));buy.disabled=BigInt(bootstrap.balance||0)<BigInt(d.price);if(buy.disabled)buy.textContent='Need '+(BigInt(d.price)-BigInt(bootstrap.balance||0)).toLocaleString()+' more coins';card.append(buy);grid.append(card);}if(options.length)root.append(grid);
   const earn=el('a','daily-game-link','Play games to earn coins ↗');earn.href='games.html';earn.target='_blank';earn.rel='noopener';root.append(earn,note('Games open in a new tab so your room stays open.'));
  }
  root.append(button('Browse Catalog',()=>showCatalog('All',{sort:'price'})),button('Back to my room',()=>$('worldPanel').close()));
 }
 $('worldGuide').onclick=()=>showFirstVisitHint(true);
 $('placementMissions').onclick=()=>{$('placementSuccess').hidden=true;showDailyMissions();};
 $('placementContinue').onclick=()=>{$('placementSuccess').hidden=true;startGuidedDecorating().catch(e=>toast(e.message));};
 $('dismissPlacementSuccess').onclick=()=>{$('placementSuccess').hidden=true;};
 async function showDailyMissions(){
  currentPanel='daily';const root=openPanel('Daily World missions'),version=panelVersion;
  if(!connected){root.append(note('Connect to World to see your daily missions.'));return;}
  if(!bootstrap.dailyMissions){root.append(note('Daily missions are arriving soon. Reconnect to check for the update.'));return;}
  root.append(note('Checking today’s progress…'));
  try{const status=await action('daily_missions');if(version!==panelVersion||!$('worldPanel').open)return;root.replaceChildren();
   const reset=new Date(status.resetsAt),missions=[...status.missions].sort((a,b)=>(a.claimed?2:a.complete?0:1)-(b.claimed?2:b.complete?0:1));
   const ready=missions.filter(m=>m.complete&&!m.claimed).length,claimed=missions.filter(m=>m.claimed).length;
   root.append(el('p','mission-summary',ready?ready+' reward'+(ready===1?'':'s')+' ready to claim':claimed===missions.length?'All daily rewards claimed':'Choose a mission to get started'),note(claimed+' of '+missions.length+' rewards claimed · Up to 15 Arcade Coins each day.'));
   const details={visit:'Visit the plaza or another public hangout today.',decorate:'Place, move, or rotate one furniture piece in your own room today. Buying furniture alone does not count.',game:'Finish a game while signed in and earn a coin reward saved to your account. Return here and refresh progress.'};
   for(const mission of missions){const state=mission.claimed?'claimed':mission.complete?'ready':'active',card=el('section','daily-world-card is-'+state);
    card.append(el('span','mission-state',mission.claimed?'CLAIMED':mission.complete?'READY TO CLAIM':'DAILY · +5 COINS'),el('h3','',mission.title),note(details[mission.id]||mission.description),el('strong','',mission.claimed?'✓ Claimed · +5 coins':mission.complete?'1 of 1 complete · +5 coins':'0 of 1 complete'));
    if(mission.complete&&!mission.claimed)card.append(button('Claim 5 coins',async()=>{await action('daily_missions',{claim:mission.id});await refresh();await showDailyMissions();toast('Daily mission claimed · +5 Arcade Coins');},'primary'));
    else if(!mission.claimed){
     if(mission.id==='visit')card.append(button('Visit plaza',()=>connect('plaza')));
     else if(mission.id==='decorate')card.append(button('Decorate my room',()=>scene.ownerId===userId?showBackpack():connect('choose-home')));
     else {const link=el('a','daily-game-link','Play an arcade game ↗');link.href='games.html';link.target='_blank';link.rel='noopener';card.append(link);}
    }
    root.append(card);
   }
   root.append(button('Refresh progress',showDailyMissions),note('Daily reset: '+reset.toLocaleString([],{weekday:'long',hour:'numeric',minute:'2-digit'})+'. Games open in a new tab.'));
   const weeklyLink=button('View weekly decorating challenge',showWeeklyChallenge);root.append(weeklyLink);
  }catch(e){if(version!==panelVersion)return;root.replaceChildren(note('Could not check missions. Your progress and coins are safe.'),button('Try again',showDailyMissions));}
 }
 $('worldDaily').onclick=()=>showDailyMissions();
 function socialPanel(title){const root=openPanel(title);if(!connected||!bootstrap.socialDiscovery){root.append(note(connected?'Reconnect to World to load this update.':'Connect to World to explore with friends.'));return null;}return root;}
 async function showRoomReactions(){
  currentPanel='reactions';const root=socialPanel('Room reactions');if(!root)return;const version=panelVersion;root.append(note('Loading reactions…'));
  try{const r=await action('reactions');if(version!==panelVersion)return;root.replaceChildren(el('h3','',scene.name),note(r.canReact?'Leave one reaction. Tap your selected reaction again to remove it.':'Visitors can leave a reaction in open player rooms.'));
   const choices=el('div','reaction-choices');for(const [key,label] of [['heart','♥ Love it'],['thumb','👍 Nice room']]){const b=button(label+' · '+Number(r[key]||0),async()=>{await action('react',{reaction:r.mine===key?null:key});await showRoomReactions();});b.setAttribute('aria-pressed',String(r.mine===key));b.disabled=!r.canReact;choices.append(b);}root.append(choices);
  }catch(e){if(version===panelVersion)root.replaceChildren(note('Reactions unavailable. Try again.'),button('Retry',showRoomReactions));}
 }
 async function showFeaturedRooms(){
  currentPanel='featured';const root=socialPanel('Featured rooms');if(!root)return;const version=panelVersion;root.append(note('Finding player creations…'));
  try{const rooms=await action('featured');if(version!==panelVersion)return;root.replaceChildren(note('Community spotlight · Open player rooms with at least 3 pieces. Visitor reactions lead the list; ties rotate weekly.'));
   const grid=el('div','featured-room-grid');for(const r of rooms){const card=el('section','featured-room-card'),canvas=el('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',r.name+' room preview');EarnlyWorldRenderer.roomThumbnail(canvas,r.heightmap,r.items);card.append(canvas,el('h3','',r.name),note('By '+r.ownerUsername+' · '+Number(r.score||0)+' reactions'),roomCount(r));if(r.weeklyEntry)card.append(el('span','weekly-entry-label','This week’s challenge entry'));card.append(button(r.ownerId===userId?'Visit my room':'Visit room',()=>connect(r.id),'primary'));grid.append(card);}root.append(grid);
   if(!rooms.length)root.append(note('The spotlight is waiting for its first rooms. Decorate an open room with 3 pieces to appear here.'),button('Go to my room',()=>connect('choose-home')));
   root.append(button('Refresh spotlight',showFeaturedRooms),button('Browse all player rooms',()=>showRooms('explore')));
  }catch(e){if(version===panelVersion)root.replaceChildren(note('Featured rooms unavailable. Try again.'),button('Retry',showFeaturedRooms));}
 }
 async function sendRoomInvite(friend){
  if(scene.access!=='open')throw new Error('Open this room to visitors from Rooms before inviting.');
  const result=await action('invite',{userId:friend.userId});toast(result.duplicate?'Your invitation is already in their inbox.':'Invited '+friend.username+' · Expires in 1 hour');
 }
 function showInviteFriends(){
  currentPanel='invite-friends';const root=socialPanel('Invite friends here');if(!root)return;
  root.append(note('Invite an accepted friend to '+scene.name+'. Invitations last 1 hour and never unlock private rooms.'));
  if(scene.access!=='open'){root.append(note('Open this room to visitors from Rooms first.'),button('Room settings',showRooms));return;}
  const friends=bootstrap.friends.filter(f=>f.accepted);for(const f of friends)root.append(row(f.username,[button('Invite here',()=>sendRoomInvite(f))]));
  if(!friends.length)root.append(note('Add a friend and accept their request to send an invitation.'),button('Find friends',showFriends));
 }
 async function showRoomInvites(){
  currentPanel='invites';const root=socialPanel('Room invitations');if(!root)return;const version=panelVersion;root.append(note('Checking invitations…'));
  try{const invites=await action('invites');if(version!==panelVersion)return;$('worldCommunity').textContent='Community';root.replaceChildren(note('Invitations from accepted friends · Expire after 1 hour.'));
   for(const i of invites){const card=el('section','room-invite-card');card.append(el('h3','',i.roomName),note('From '+i.username+' · Until '+new Date(i.expiresAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})),button('Join room',()=>connect(i.roomId),'primary'),button('Dismiss',async()=>{await action('dismiss_invite',{id:i.id});await showRoomInvites();}));root.append(card);}
   if(!invites.length)root.append(note('No invitations right now. Invite a friend to join you.'));
   root.append(button('Invite friends here',showInviteFriends),button('Refresh invitations',showRoomInvites));
  }catch(e){if(version===panelVersion)root.replaceChildren(note('Invitations unavailable. Try again.'),button('Retry',showRoomInvites));}
 }
 async function showWeeklyChallenge(){
  currentPanel='weekly';const root=socialPanel('Weekly decorating challenge');if(!root)return;const version=panelVersion;root.append(note('Loading this week’s theme…'));
  try{const w=await action('weekly');if(version!==panelVersion)return;
   const own=scene.ownerId===userId,count=(scene.items||[]).length,open=scene.access==='open';
   root.replaceChildren(el('p','weekly-entry-label','THIS WEEK · +10 ARCADE COINS'),el('h3','weekly-theme',w.theme),note('Use this theme for inspiration. Any furniture counts — no new purchases needed.'));
   if(w.entered){root.append(el('strong','weekly-complete','✓ Entered · 10 coins claimed'),note('You’re done for this week! Come back after the reset for a new theme.'));if(w.entryRoomId)root.append(button('Visit my entry',()=>connect(w.entryRoomId)));}
   else {
    const steps=el('ol','weekly-steps');
    for(const [title,detail,done] of [
     ['Choose your own room',own?'You’re in '+scene.name+'.':'Visit your room before starting.',own],
     ['Place at least 3 furniture pieces',own?Math.min(count,3)+' of 3 pieces placed.':'Furniture in your Backpack counts once you place it.',own&&count>=3],
     ['Allow visitors',own&&open?'Your room is open.':'Open Rooms → Allow visitors.',own&&open],
     ['Make one change this week',w.ready?'Your decorating change is complete.':'Place, move, or rotate one piece this week. Check progress to confirm all requirements.',w.ready]
    ]){const item=el('li',done?'is-complete':'');item.append(el('strong','',(done?'✓ ':'')+title),note(detail));steps.append(item);}
    root.append(el('p','mission-summary',w.ready?'Ready to enter · Claim 10 coins':!own?'Next: visit your own room':count<3?'Next: place '+(3-count)+' more furniture piece'+(3-count===1?'':'s'):!open?'Next: allow visitors':'Next: make a decorating change, then check progress'),steps);
    const actions=el('div','weekly-actions');
    if(w.ready)actions.append(button('Enter this room & claim 10 coins',async()=>{await action('weekly_enter');await refresh();await showWeeklyChallenge();toast('Challenge entered · +10 Arcade Coins');},'primary'));
    else {if(!own)actions.append(button('Go to my room',()=>connect('choose-home'),'primary'));else if(count>=3&&!open)actions.append(button('Allow visitors · Room settings',showRooms,'primary'));else actions.append(button('Decorate my room',showBackpack,'primary'));actions.append(button('Check progress',showWeeklyChallenge));}
    root.append(actions,note('Once all steps are complete, claim your 10 coins here. Everyone who completes the steps can earn the reward.'));
   }
   root.append(note('Next theme: '+new Date(w.endsAt).toLocaleString([],{weekday:'long',hour:'numeric',minute:'2-digit'})+' · One reward per week.'),button('See other rooms',showFeaturedRooms));
  }catch(e){if(version===panelVersion)root.replaceChildren(note('Challenge unavailable. Your coins are safe.'),button('Retry',showWeeklyChallenge));}
 }
 function showCommunity(){const root=socialPanel('World community');if(!root)return;const grid=el('div','community-menu');for(const [id,label,description,run] of [
  ['worldFeatured','★ Featured rooms','Discover spaces made by other players.',showFeaturedRooms],
  ['worldReactions','♡ Room reactions','Leave a little appreciation for this room.',showRoomReactions],
  ['worldInvites','♧ Room invitations','Meet an accepted friend in World.',showRoomInvites],
  ['worldWeekly','✦ Weekly challenge','A fresh decorating theme and 10 coins.',showWeeklyChallenge]
 ]){const card=button('',run);card.id=id;card.append(el('strong','',label),el('span','',description));grid.append(card);}root.append(grid);}
 $('worldCommunity').onclick=showCommunity;

 $('dismissWorldHint').onclick=()=>{guideResumed=false;$('firstVisitHint').hidden=true;try{localStorage.setItem('earnly.world.hint.'+userId,'1');}catch{}};
 $('shareRoom').onclick=()=>{
  if(!connected||!scene)return;
  const root=openPanel('Share this room');
  if(scene.access==='closed'){root.append(note('This room is private. Open it to visitors from Rooms before inviting friends.'));return;}
  if(bootstrap.socialDiscovery)root.append(button('Invite a friend here',showInviteFriends,'primary'));
  const url=window.EarnlyWorldLinks.shareURL(scene.roomId);
  root.append(note('Invite a friend to '+scene.name+'. They will need an Earnly account.'));
  const input=el('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label','Room link');input.onclick=()=>input.select();root.append(input);
  if(navigator.share)root.append(button('Share invitation',async()=>{try{await navigator.share({title:'Join me in Earnly World',text:'Meet me in '+scene.name,url});}catch(e){if(e.name!=='AbortError')toast('Use Copy link to share this room.');}},'primary'));
  root.append(button('Copy link',async()=>{try{await navigator.clipboard.writeText(url);toast('Room link copied');}catch{input.focus();input.select();toast('Select and copy the room link above.');}}),note('Sharing keeps you connected here. Private rooms and room permissions still apply.'));
 };

 bootstrap.catalog=demoCatalog;
 collectionPreview($('worldInspiration'),EarnlyWorldCollections.collections[0]);$('browseDecor').onclick=()=>showCatalog();
 $('startDecorating').onclick=()=>showCatalog();$('findHangout').onclick=()=>showRooms('public');
 entryState();
 if(sharedRoom)connect(sharedRoom).catch(e=>entryState(e.message));
 else {const category=new URLSearchParams(location.search).get('catalog');if(category)showCatalog(category);}
 window.addEventListener('online',()=>{if(!connected&&!connecting&&waitingForNetwork)connect(entryTarget,true).catch(e=>entryState(e.message));});
})();
