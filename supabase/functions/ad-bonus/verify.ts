import { verify } from 'node:crypto';
import { Buffer } from 'node:buffer';
const KEY_URL='https://www.gstatic.com/admob/reward/verifier-keys.json';
const UNITS=new Set(['ca-app-pub-8864401806510610/8249888009','ca-app-pub-8864401806510610/1831908609']);
let cache:{keys:any[],until:number}={keys:[],until:0};
export async function googleKeys(){
 if(cache.until>Date.now())return cache.keys;
 const res=await fetch(KEY_URL,{signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw new Error('Key service unavailable');
 const body=await res.json();
 if(!Array.isArray(body.keys)||body.keys.length>20)throw new Error('Invalid key response');
 cache={keys:body.keys,until:Date.now()+3600000};return cache.keys;
}
export function verifyReceipt(url:string,keys:any[],now=Date.now()){
 const raw=new URL(url).search.slice(1);
 if(raw.length>8192)throw new Error('Oversized receipt');
 const match=raw.match(/^(.*)&signature=([^&]+)&key_id=(\d+)$/);
 if(!match)throw new Error('Invalid signature fields');
 const p=new URLSearchParams(raw);
 for(const name of p.keys())if(p.getAll(name).length!==1)throw new Error('Duplicate field');
 const key=keys.find(k=>String(k.keyId)===match[3]);
 if(!key?.pem||!verify('sha256',Buffer.from(match[1]),key.pem,Buffer.from(decodeURIComponent(match[2]),'base64url')))throw new Error('Invalid signature');
 let unit=p.get('ad_unit')||'';
 if(['8249888009','1831908609'].includes(unit))unit='ca-app-pub-8864401806510610/'+unit;
 const ticket=p.get('custom_data')||'',transaction=p.get('transaction_id')||'';
 const time=Number(p.get('timestamp'));
 if(!UNITS.has(unit)||!/^\d+$/.test(p.get('timestamp')||'')||time>now+300000||time<now-172800000)throw new Error('Invalid receipt context');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket)||!transaction||transaction.length>128)throw new Error('Invalid reward identity');
 return {ticket,transaction,unit,time:new Date(time).toISOString()};
}
