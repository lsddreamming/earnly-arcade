/* Original World art. Previews never create inventory or unlock membership. */
(()=>{
 const root=document.getElementById('vip-furniture');if(!root)return;
 const gifts=[
  {id:'vip-neon-throne',name:'Sovereign Neon Throne',sprite_id:'vip-throne',color:'#b09af2',months:'Jan · Apr · Jul · Oct',description:'A crown-topped seat with jewel tones and neon edges. Give your room its centerpiece.',theme:'lobby'},
  {id:'vip-aurora-fountain',name:'Aurora Crystal Fountain',sprite_id:'vip-fountain',color:'#79e8dc',months:'Feb · May · Aug · Nov',description:'A luminous crystal wrapped in golden rings. Build a tranquil corner with a little cosmic drama.',theme:'rooftop'},
  {id:'vip-lunar-bloom',name:'Lunar Bloom Conservatory',sprite_id:'vip-bloom',color:'#b4a1f3',months:'Mar · Jun · Sep · Dec',description:'Sculptural crystal blooms inside a delicate glass frame. Turn your room into a moonlit retreat.',theme:'patio'}
 ];
 let selected=null;
 function preview(index,userChosen=false){
  if(userChosen)selected=index;const gift=gifts[index];
  document.getElementById('vip-preview-name').textContent=gift.name;
  document.getElementById('vip-preview-description').textContent=gift.description;
  const state=window.EarnlyPass||{},featured=state.furnitureAvailable&&Number.isInteger(state.giftMonth)&&state.giftMonth%3===index;
  document.getElementById('vip-preview-tag').textContent=featured?'THIS MONTH’S FEATURED GIFT':'COLLECTION SPOTLIGHT';
  root.querySelectorAll('.vip-gift-grid button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
  const canvas=document.getElementById('vip-room-preview');canvas.setAttribute('aria-label',gift.name+' styled in an example room');
  window.EarnlyWorldRenderer?.roomThumbnail(canvas,'00000\n00000\n00000\n00000\n00000',[
   {...gift,sprite:gift.sprite_id,x:2,y:2,z:0,rotation:0,width:1,length:1},
   {sprite:'plant',color:'#85b99c',x:0,y:1,z:0,width:1,length:1},
   {sprite:'lamp',color:'#e8ca8a',x:4,y:1,z:0,width:1,length:1}
  ],gift.theme);
 }
 function render(){
  const state=window.EarnlyPass||{},grid=root.querySelector('.vip-gift-grid');grid.replaceChildren();
  for(const [index,gift] of gifts.entries()){
   const card=document.createElement('figure'),button=document.createElement('button'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption'),months=document.createElement('small');
   button.type='button';button.setAttribute('aria-label','Preview '+gift.name);button.onclick=()=>preview(index,true);
   canvas.setAttribute('aria-hidden','true');window.EarnlyWorldRenderer?.thumbnail(canvas,gift);
   caption.textContent=gift.name;months.textContent=gift.months+' (UTC)';button.append(canvas,caption,months);card.append(button);
   if(state.furnitureAvailable&&Number.isInteger(state.giftMonth)&&state.giftMonth%3===index)card.className='featured-gift';grid.append(card);
  }
  document.getElementById('vip-gift-availability').textContent=state.furnitureAvailable&&Number.isInteger(state.giftMonth)?'This month’s paid-period gift: '+gifts[state.giftMonth%3].name:'Monthly furniture gifts coming soon.';
  const awards=Array.isArray(state.furniture)?state.furniture:[],delivered=awards.filter(a=>a.delivered&&!a.revoked).length,pending=awards.filter(a=>!a.delivered&&!a.revoked).length;
  document.getElementById('vip-gift-delivery').textContent=pending?pending+' gift(s) waiting. Make space in your World Backpack, then refresh this page.':delivered?delivered+' VIP gift(s) delivered to your World Backpack.':'';
  preview(selected??(state.furnitureAvailable&&Number.isInteger(state.giftMonth)?state.giftMonth%3:0));
 }
 window.addEventListener('earnly-pass-change',render);render();
})();
