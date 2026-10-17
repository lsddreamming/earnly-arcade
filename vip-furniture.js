/* Previews use the exact World renderer. The browser never creates inventory. */
(()=>{
 const root=document.getElementById('vip-furniture');if(!root)return;
 const gifts=[{id:'vip-neon-throne',name:'Sovereign Neon Throne',sprite_id:'vip-throne',color:'#b09af2',months:'Jan · Apr · Jul · Oct'},{id:'vip-aurora-fountain',name:'Aurora Crystal Fountain',sprite_id:'vip-fountain',color:'#79e8dc',months:'Feb · May · Aug · Nov'},{id:'vip-lunar-bloom',name:'Lunar Bloom Conservatory',sprite_id:'vip-bloom',color:'#b4a1f3',months:'Mar · Jun · Sep · Dec'}];
 function render(){
  const state=window.EarnlyPass||{},grid=root.querySelector('.vip-gift-grid');grid.replaceChildren();
  for(const [index,gift] of gifts.entries()){
   const card=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption'),months=document.createElement('small');
   canvas.setAttribute('role','img');canvas.setAttribute('aria-label',gift.name);window.EarnlyWorldRenderer?.thumbnail(canvas,gift);
   caption.textContent=gift.name;months.textContent=gift.months+' (UTC)';card.append(canvas,caption,months);
   if(state.furnitureAvailable&&Number.isInteger(state.giftMonth)&&state.giftMonth%3===index)card.className='featured-gift';grid.append(card);
  }
  document.getElementById('vip-gift-availability').textContent=state.furnitureAvailable&&Number.isInteger(state.giftMonth)?'This month’s paid-period gift: '+gifts[state.giftMonth%3].name:'Monthly furniture gifts coming soon.';
  const awards=Array.isArray(state.furniture)?state.furniture:[],delivered=awards.filter(a=>a.delivered&&!a.revoked).length,pending=awards.filter(a=>!a.delivered&&!a.revoked).length;
  document.getElementById('vip-gift-delivery').textContent=pending?pending+' gift(s) waiting. Make space in your World Backpack, then refresh this page.':delivered?delivered+' VIP gift(s) delivered to your World Backpack.':'';
 }
 window.addEventListener('earnly-pass-change',render);render();
})();
