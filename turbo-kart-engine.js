/* Original Earnly circuit racer. Fixed-step simulation, shared by browser and tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TurboKartEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const LAPS=3,LIMIT=90,WIDTH=104;
  const anchors=[[0,260],[-270,250],[-390,70],[-330,-180],[-140,-300],[80,-250],[300,-300],[390,-90],[260,60],[140,140]];
  const points=[];let length=0;
  for(let i=0;i<anchors.length;i++)for(let j=0;j<50;j++){
    const a=anchors[(i+anchors.length-1)%anchors.length],b=anchors[i],c=anchors[(i+1)%anchors.length],d=anchors[(i+2)%anchors.length],t=j/50;
    const p={};for(const [k,n]of [['x',0],['y',1]])p[k]=.5*(2*b[n]+(-a[n]+c[n])*t+(2*a[n]-5*b[n]+4*c[n]-d[n])*t*t+(-a[n]+3*b[n]-3*c[n]+d[n])*t*t*t);
    if(points.length)length+=Math.hypot(p.x-points.at(-1).x,p.y-points.at(-1).y);p.d=length;points.push(p);
  }
  length+=Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y);
  function sample(distance,offset=0){const d=((distance%length)+length)%length;let lo=0,hi=points.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(points[m].d<=d)lo=m;else hi=m-1;}
    const a=points[lo],b=points[(lo+1)%points.length],span=(lo===points.length-1?length:b.d)-a.d,t=(d-a.d)/span,angle=Math.atan2(b.y-a.y,b.x-a.x);
    return {x:a.x+(b.x-a.x)*t-Math.sin(angle)*offset,y:a.y+(b.y-a.y)*t+Math.cos(angle)*offset,angle};
  }
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  function create(){return {time:0,ended:false,finished:false,place:5,coins:0,item:null,itemIndex:0,driftCharge:0,drifts:0,wasDrifting:false,events:[],callout:'',calloutUntil:0,
    racers:['YOU','PIP','NOVA','REMY','FERN'].map((name,i)=>({name,d:-i*27,lane:i%2?22:-22,speed:0,boost:0,shield:0,slow:0,cooldown:0,finishTime:null,color:['#70f5d2','#ffca73','#c39bff','#ff7f9e','#7ebcff'][i]})),
    pickups:Array.from({length:9},(_,i)=>({d:length*(.07+i*.105),lane:[-28,0,28][i%3],type:i%3===0?'item':'coin',takenLap:-1})),pads:[{d:length*.27,lane:-26},{d:length*.69,lane:27}]};}
  function announce(s,text){s.callout=text;s.calloutUntil=s.time+1.7;}
  function useItem(s){if(s.ended||!s.item)return;const p=s.racers[0],item=s.item;s.item=null;
    if(item==='boost'){p.boost=2.6;announce(s,'TURBO BURST');}
    if(item==='shield'){p.shield=6;announce(s,'SHIELD UP');}
    if(item==='pulse'){for(const r of s.racers.slice(1))if(Math.abs(r.d-p.d)<180&&!r.shield)r.slow=2.8;announce(s,'PULSE RELEASED');}
  }
  function rank(s){const p=s.racers[0];return 1+s.racers.slice(1).filter(r=>p.finishTime!==null?r.finishTime!==null&&r.finishTime<p.finishTime:r.finishTime!==null||r.d>p.d).length;}
  function rewards(s){if(!s.ended||!s.finished)return 0;return [20,15,12,9,7][s.place-1]+Math.min(5,s.coins);}
  function score(s){return s.finished?(6-s.place)*1000+Math.max(0,Math.floor((LIMIT-s.time)*10)):0;}
  function tick(s,dt,input={}){
    if(s.ended||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);s.time+=dt;s.events=[];
    const p=s.racers[0],steer=clamp(Number(input.steer)||0,-1,1),drifting=!!input.drift&&Math.abs(steer)>.1&&Math.abs(p.lane)<WIDTH/2;
    if(input.item)useItem(s);
    if(drifting){s.driftCharge=Math.min(1.6,s.driftCharge+dt);}else if(s.wasDrifting){if(s.driftCharge>=.7){p.boost=Math.max(p.boost,1.2+s.driftCharge*.45);s.drifts++;announce(s,'DRIFT BOOST');}s.driftCharge=0;}
    s.wasDrifting=drifting;
    for(let i=0;i<s.racers.length;i++){
      const r=s.racers[i];if(r.finishTime!==null)continue;
      for(const k of ['boost','shield','slow','cooldown'])r[k]=Math.max(0,r[k]-dt);
      const bend=angleDiff(sample(r.d+24).angle,sample(r.d).angle);
      if(i===0){r.lane=clamp(r.lane+(steer*(drifting?49:67)-bend*r.speed*1.8)*dt,-74,74);}
      else {const target=Math.sin(s.time*.65+i*2)*28;r.lane+=(target-r.lane)*dt*1.8;if(Math.sin(s.time*.8+i)> .985)r.boost=.5;}
      const off=Math.abs(r.lane)>WIDTH/2-5,base=i?88+i*1.1:96;
      const target=base*(off?.48:1)*(r.slow>0?.6:1)*(r.boost>0?1.42:1)*(drifting&&i===0?.9:1);
      r.speed+=(target-r.speed)*Math.min(1,dt*2);const before=r.d;r.d+=r.speed*dt;
      if(r.d>=length*LAPS){r.finishTime=s.time-dt+(length*LAPS-before)/(r.d-before)*dt;r.d=length*LAPS;}
      if(i===0){
        for(const pick of s.pickups){const lap=Math.floor(r.d/length),next=lap*length+pick.d;if(before<=next&&r.d>=next&&Math.abs(r.lane-pick.lane)<19&&pick.takenLap!==lap){pick.takenLap=lap;if(pick.type==='coin'){s.coins=Math.min(5,s.coins+1);announce(s,s.coins<5?'+1 BONUS COIN':'BONUS COINS FULL');}else if(!s.item){s.item=['boost','shield','pulse'][s.itemIndex++%3];announce(s,s.item.toUpperCase()+' READY');}}}
        for(const pad of s.pads){const next=Math.floor(r.d/length)*length+pad.d;if(before<=next&&r.d>=next&&Math.abs(r.lane-pad.lane)<22){r.boost=Math.max(r.boost,1.6);announce(s,'BOOST PAD');}}
      }
    }
    for(const r of s.racers.slice(1))if(!p.cooldown&&Math.abs(r.d-p.d)<18&&Math.abs(r.lane-p.lane)<18&&r.finishTime===null){if(!p.shield){p.slow=.7;p.lane=clamp(p.lane+(p.lane>=r.lane?10:-10),-74,74);announce(s,'BUMP · KEEP RACING');}p.cooldown=1;r.slow=.4;}
    s.place=rank(s);
    if(p.finishTime!==null||s.time>=LIMIT){s.ended=true;s.finished=p.finishTime!==null;s.time=s.finished?p.finishTime:LIMIT;s.place=rank(s);s.driftCharge=0;}
  }
  return {LAPS,LIMIT,WIDTH,length,points,sample,create,tick,useItem,rewards,score,rank};
});
