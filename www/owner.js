(()=>{
 const $=id=>document.getElementById(id);let sequence=0;
 const number=value=>Number(value||0).toLocaleString();
 function cards(id,values){$(id).replaceChildren(...values.map(([label,value])=>{const card=document.createElement('article');card.className='metric';const n=document.createElement('strong'),l=document.createElement('span');n.textContent=number(value);l.textContent=label;card.append(n,l);return card;}));}
 async function refresh(){
  const current=++sequence;$('report').hidden=true;$('refresh').disabled=true;$('signIn').hidden=true;$('status').textContent='Loading owner activity…';
  try{
   const r=await window.EarnlyActivity.request({action:'report',days:Number($('days').value),includeTests:$('includeTests').checked});if(current!==sequence)return;
   if(!r){$('status').textContent='Sign in to your owner account to view activity.';$('signIn').hidden=false;return;}
   cards('signups',[['Total accounts',r.signups.total],['Signed up today',r.signups.today],['Signed up · 7 days',r.signups.week]]);
   cards('world',[['Unique players',r.world.players],['Room entries',r.world.entries],['Returning players',r.world.returning],['Connect attempts',r.world.attempts],['Failed connections',r.world.failures],['Reconnect attempts',r.world.reconnects]]);
   cards('shop',[['Shop views',r.shop.views],['Shop visitors',r.shop.players],['Purchase attempts',r.shop.attempts],['Verified coin purchases',r.shop.purchases],['Unique buyers',r.shop.buyers]]);
   $('rooms').replaceChildren();for(const room of r.rooms){const row=document.createElement('tr');for(const value of [room.name,number(room.entries),number(room.players),number(room.peak)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}$('rooms').append(row);}
   if(!r.rooms.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.textContent='No recorded room entries in this period yet.';row.append(cell);$('rooms').append(row);}
   const format=d=>new Date(d).toLocaleString('en-US',{timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'short'});
   $('coverage').textContent='New activity tracking began '+format(r.trackingSince)+' CT. '+(r.includeTests?'Marked owner/test accounts included.':'Marked owner/test accounts excluded.');
   $('status').textContent='Updated '+format(r.generatedAt)+' CT';$('report').hidden=false;
  }catch(error){if(current===sequence)$('status').textContent=error.message||'Report unavailable. Try again.';}
  finally{if(current===sequence)$('refresh').disabled=false;}
 }
 $('filters').addEventListener('submit',e=>{e.preventDefault();refresh();});
 window.EarnlyCloud?.client?.auth?.onAuthStateChange?.((event)=>{if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;sequence++;$('report').hidden=true;$('status').textContent='Account changed. Refresh to view activity.';});
 refresh();
})();
