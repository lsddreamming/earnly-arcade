/* Presentation only: prices, balance and ownership remain server-owned. */
(()=>{
 const $=id=>document.getElementById(id);
 const nav=document.createElement('nav');nav.className='store-sections';nav.setAttribute('aria-label','Shop departments');
 const departments=[['Style studio','style'],['Coin packs','coins'],['Featured & rooms','featured'],['VIP Pass','vip']];
 const sections={style:[document.querySelector('.studio-layout'),document.querySelector('.shop-collections'),$('collection-window'),$('ion-pack-preview')],coins:[$('coin-shop')],featured:[$('signature-looks')],vip:[$('vip-pass')]};
 const room=document.createElement('section');room.id='room-collections';room.className='panel room-collections';
 room.innerHTML='<p class="eyebrow">ROOM COLLECTIONS</p><h2>Make yourself at home.</h2><p>Real World furniture. Pick the pieces you love.</p><div class="room-editions"><a href="world.html?catalog=Neon%20Boardwalk"><canvas class="room-scene" data-room-preview="boardwalk" role="img" aria-label="Neon Boardwalk room with a sofa, rug, side table, floor lamp and palm"></canvas><div class="room-edition-copy"><strong>Neon Boardwalk</strong><small>Neon lounge · Garden greenery</small><span>Explore furniture →</span></div></a><a href="world.html?catalog=Garden"><canvas class="room-scene" data-room-preview="garden" role="img" aria-label="Garden patio with chairs, a parasol table, lantern, flowers and trees"></canvas><div class="room-edition-copy"><strong>Garden escape</strong><small>Leafy corners · Warm lanterns</small><span>Explore furniture →</span></div></a></div><p class="collection-note">Styled room ideas. Each piece is available separately in World.</p>';
 const piece=(id,sprite,color,x,y,width=1,length=1,z=0)=>({id,sprite,color,x,y,width,length,z,rotation:0});
 const scenes={boardwalk:[piece('boardwalk-rug','rug','#c18bd5',2,2,2,2),piece('boardwalk-sofa','sofa','#63dcd6',1,1,2),piece('boardwalk-table','table','#80bfc9',3,2,1,1,.25),piece('boardwalk-lamp','lamp','#e2a0ed',4,1),piece('palm-tree','palm','#65be86',0,3),piece('flower-pot','flowers','#eab2ed',4,4)],garden:[piece('ficus-tree','tree','#71bc80',0,1),piece('blossom-tree','tree','#eea2c2',4,1),piece('garden-parasol','umbrella','#edbd85',2,2),piece('sage-chair-a','chair','#91bb96',1,3),piece('sage-chair-b','chair','#91bb96',3,3),piece('flower-pot','flowers','#eab2ed',0,4),piece('amber-lantern','lamp','#edc582',4,4)]};
 for(const canvas of room.querySelectorAll('canvas')){const key=canvas.dataset.roomPreview;window.EarnlyWorldRenderer.roomThumbnail(canvas,Array(6).fill('000000').join('\n'),scenes[key],key==='garden'?'patio':undefined);}

 $('signature-looks').after(room);sections.featured.push(room);
 const heading=document.createElement('div');heading.className='store-heading';heading.innerHTML='<span>THE ARCADE STORE</span><p>Earn it. Collect it. Make it yours.</p>';document.querySelector('.page-title').after(heading);heading.after(nav);
 function show(key){for(const [name,nodes] of Object.entries(sections))for(const n of nodes)if(n)n.classList.toggle('department-hidden',name!==key);for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.department===key));if(key==='coins')$('coin-pack-options').open=true;if(key==='vip')$('vip-pass').open=true;}
 for(const [name,key] of departments){const b=document.createElement('button');b.type='button';b.dataset.department=key;b.textContent=name;b.onclick=()=>show(key);nav.append(b);}
 const routes={'#coin-shop':'coins','#signature-looks':'featured','#room-collections':'featured','#vip-pass':'vip','#collection':'style'};
 function followHash(){const key=routes[location.hash];if(key)show(key);}
 document.addEventListener('click',e=>{if(e.target.closest('.look-card button')){show('style');document.querySelector('.showcase').scrollIntoView({block:'start',behavior:'smooth'});}const a=e.target.closest('a[href^="#"]');if(a&&routes[a.getAttribute('href')])show(routes[a.getAttribute('href')]);});
 window.addEventListener('hashchange',followHash);show(routes[location.hash]||(new URLSearchParams(location.search).has('coin_order')||new URLSearchParams(location.search).has('coin_cancelled')?'coins':'style'));
 const balance=document.createElement('p');balance.className='store-balance';$('coins-title').after(balance);
 const updateBalance=()=>{balance.textContent='Your balance · '+$('coin-balance').textContent+' Arcade Coins';};new MutationObserver(updateBalance).observe($('coin-balance'),{childList:true,subtree:true,characterData:true});updateBalance();
 const status=$('coin-status');new MutationObserver(()=>{$('coin-shop').classList.toggle('purchase-confirmed',/^Purchase confirmed/.test(status.textContent));}).observe(status,{childList:true,characterData:true,subtree:true});
})();
