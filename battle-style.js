/* Cosmetic state is server-owned. These values are read by rendering only. */
(()=>{let equipped={},sequence=0;const colors={army:'#c7b1ff',building:'#8aecd7',battlefx:'#e8a6ff'};
 window.EarnlyBattleStyle={color:slot=>equipped[slot]?.id==='ion-'+slot?colors[slot]:null};
 async function refresh(){const stamp=++sequence;equipped={};try{const session=await window.EarnlyCloud?.session?.();if(!session)return;const response=await fetch('https://zdwziebtbpuolusztede.supabase.co/functions/v1/avatars/api/me',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});if(!response.ok)return;const data=await response.json();if(stamp!==sequence)return;equipped=data.user?.equipped||{};const title=document.querySelector('h1');if(title&&equipped.commander?.id==='ion-commander'){const badge=document.createElement('span');badge.textContent=' · Ion Commander';badge.style.color='#c7b1ff';badge.className='commander-style';title.querySelector('.commander-style')?.remove();title.append(badge);}}catch{}}
 window.addEventListener('earnly-cloud-ready',refresh);window.addEventListener('earnly-cloud-auth-change',refresh);if(window.EarnlyCloud)refresh();
})();
