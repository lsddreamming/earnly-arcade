/* Presentation only: prices, balance and ownership remain server-owned. */
(()=>{
 const $=id=>document.getElementById(id);
 const nav=document.createElement('nav');nav.className='store-sections';nav.setAttribute('aria-label','Shop departments');
 const departments=[['Style studio','style'],['Coin packs','coins'],['Featured & rooms','featured'],['VIP Pass','vip']];
 const sections={style:[document.querySelector('.studio-layout'),document.querySelector('.shop-collections'),$('collection-window'),$('ion-pack-preview')],coins:[$('coin-shop')],featured:[$('signature-looks')],vip:[$('vip-pass')]};
 const room=document.createElement('section');room.id='room-collections';room.className='panel room-collections';
 room.innerHTML='<p class="eyebrow">MAKE ROOM FOR YOUR STYLE</p><h2>Your room. Your atmosphere.</h2><p>Preview furniture in World, then unlock individual pieces with earned or purchased coins.</p><div class="room-editions"><a href="world.html?catalog=Neon%20Boardwalk"><span class="room-scene boardwalk" aria-hidden="true"><i></i><b></b><em></em></span><strong>Neon Boardwalk</strong><small>Electric cyan, sunset coral, glowing accents</small><span>Preview in World →</span></a><a href="world.html?catalog=Garden"><span class="room-scene garden" aria-hidden="true"><i></i><b></b><em></em></span><strong>Garden escape</strong><small>Greenery, warm lanterns, cozy seating</small><span>Preview in World →</span></a></div><p class="collection-note">No random rewards. Choose each piece. Your existing rooms and furniture stay yours.</p>';
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
