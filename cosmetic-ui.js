// Shared integration for the existing Profile and World Ranks pages.
(() => {
  const endpoint='https://zdwziebtbpuolusztede.supabase.co/functions/v1/avatars/api';
  let user=null, generation=0;
  const element=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
  function portrait(item){const img=element('img');img.src=new URL(item.imageUrl,location.href).href;img.alt=item.name;return img;}
  const dialog=element('dialog','cosmetic-player-dialog');
  dialog.setAttribute('aria-label','Player profile');
  document.body.append(dialog);
  function paint(){
    if(!user)return;
    for(const id of ['profileAvatar','myAvatar']){
      const root=document.getElementById(id);if(!root)continue;
      root.replaceChildren(portrait(user.equipped.avatar));root.classList.add('cosmetic-profile-avatar');
    }
  }
  async function sync(){
    const stamp=++generation;
    try{
      const session=await window.EarnlyCloud?.session();
      if(!session){user=null;return;}
      const response=await fetch(endpoint+'/me',{headers:{Authorization:'Bearer '+session.access_token}});
      if(!response.ok)return;
      const data=await response.json();if(stamp!==generation)return;
      user=data.user;paint();
    }catch{}
  }
  async function openProfile(username,game='snake'){
    const stamp=++generation;
    try{
      const response=await fetch(endpoint+'/user/'+encodeURIComponent(username)+'?game='+encodeURIComponent(game));
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Could not load player.');
      if(stamp!==generation)return;
      const p=data.profile;
      dialog.replaceChildren();
      const close=element('button','cosmetic-close','×');close.type='button';close.setAttribute('aria-label','Close player profile');close.onclick=()=>dialog.close();
      const stage=element('div','cosmetic-card-character '+p.equippedAvatar.rarity);
      for(const slot of ['avatar','outfit','weapon'])if(p.equipped[slot])stage.append(portrait(p.equipped[slot]));
      const name=element('h2','','@'+p.username);name.id='cosmetic-player-name';dialog.setAttribute('aria-labelledby',name.id);
      const stats=element('dl','cosmetic-card-stats');
      const values=[['World rank',p.rank?'#'+p.rank:'Unranked'],['High score',BigInt(p.highScore).toLocaleString()],['Games recorded',BigInt(p.gamesPlayed).toLocaleString()],['Skins owned',String(p.totalSkinsUnlocked)]];
      for(const [label,value] of values){const row=element('div');row.append(element('dt','',label),element('dd','',value));stats.append(row);}
      dialog.append(close,stage,name,element('p','cosmetic-card-rarity',p.equippedAvatar.rarity.toUpperCase()+' · '+p.game),stats);
      const outfit=element('p','cosmetic-card-loadout',[p.equipped.outfit?.name,p.equipped.weapon?.name].filter(Boolean).join(' · '));dialog.append(outfit);
      if(!dialog.open)dialog.showModal();
    }catch(error){window.Arcade?.toast?.(error.message||'Could not open profile.');}
  }
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  document.addEventListener('click',event=>{const button=event.target.closest('.leader-profile-link,.leader-avatar[data-username]');if(button)openProfile(button.dataset.username,document.getElementById('gameSelect')?.value||'snake');});
  for(const event of ['earnly-cloud-ready','earnly-cloud-auth-change','earnly-cloud-synced'])window.addEventListener(event,sync);
  for(const event of ['earnly-data-change','earnly-server-rewards-synced'])window.addEventListener(event,()=>setTimeout(paint,0));
  window.EarnlyCosmetics={sync,openProfile};
  if(window.EarnlyCloud)sync();
})();
