(()=>{'use strict';
const URL='https://zdwziebtbpuolusztede.supabase.co',KEY='sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ';
let client;
function db(){if(!client){if(!window.CrystalSupabase?.createClient)throw Error('Online play could not load. Check your connection.');client=window.CrystalSupabase.createClient(URL,KEY)}return client}
async function action(type,code=null,id=null){const c=db(),{data:auth,error:authError}=await c.auth.getSession();if(authError)throw authError;if(!auth.session||auth.session.user?.is_anonymous)throw Error('Sign in to play with a friend');await c.realtime.setAuth(auth.session.access_token);const {data,error}=await c.rpc('crystal_room_action',{p_action:type,p_code:code,p_id:id});if(error)throw error;return data}
function connect(room,onMessage,onStatus){const c=db(),channels=[],own=room.side;let closed=false,ready=[false,false];
 for(const side of[0,1]){const ch=c.channel(`cc:${room.id}:${side}`,{config:{private:true,broadcast:{ack:true,self:false}}});channels[side]=ch;
  ch.on('broadcast',{event:'wire'},({payload})=>{if(closed||side===own||!payload||typeof payload!=='object'||payload.version!==1)return;onMessage(payload,side)});
  ch.subscribe((status,error)=>{if(closed)return;ready[side]=status==='SUBSCRIBED';onStatus(ready.every(Boolean),error||status)});
 }
 return{
  async send(payload){if(closed||!ready[own])return false;const result=await channels[own].send({type:'broadcast',event:'wire',payload:{...payload,version:1}});return result==='ok'},
  get connected(){return ready.every(Boolean)},
  async close(){if(closed)return;closed=true;await Promise.all(channels.map(ch=>c.removeChannel(ch)))}
 };
}
window.CrystalNetwork={action,connect};})();
