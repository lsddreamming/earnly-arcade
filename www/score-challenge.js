/* Friendly score targets are device scores, never verified rewards or rankings. */
(function(root){
 'use strict';
 const validScore=value=>/^\d{1,6}$/.test(String(value))?Number(value):null;
 function target(search){return validScore(new URLSearchParams(search).get('challenge'));}
 function link(score){
  const url=new URL('https://earnlyarcade.com/neon-slice.html');
  const safe=validScore(score);if(safe===null)throw Error('Invalid challenge score');
  url.search=new URLSearchParams({challenge:String(safe),utm_source:'player',utm_medium:'share',utm_campaign:'neon_slice_challenge'}).toString();
  return url.href;
 }
 function card(score,combo){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,1080,1350);
  gradient.addColorStop(0,'#213855');gradient.addColorStop(1,'#081323');c.fillStyle=gradient;c.fillRect(0,0,1080,1350);
  c.strokeStyle='#5adbe4';c.lineWidth=4;c.strokeRect(54,54,972,1242);
  c.textAlign='center';c.fillStyle='#a8fbef';c.font='700 30px system-ui';c.fillText('E A R N L Y   A R C A D E',540,155);
  c.fillStyle='#ffffff';c.font='800 96px system-ui';c.fillText('Neon Slice',540,325);
  c.fillStyle='#b1c7d5';c.font='500 38px system-ui';c.fillText('CAN YOU BEAT MY SCORE?',540,415);
  c.fillStyle='#a8fbef';c.font='900 180px system-ui';c.fillText(String(score),540,675);
  c.fillStyle='#ffffff';c.font='700 44px system-ui';c.fillText('POINTS',540,745);
  c.fillStyle='#ffe1a0';c.font='700 44px system-ui';c.fillText('Best combo  '+combo+'×',540,860);
  c.fillStyle='#b1c7d5';c.font='400 30px system-ui';c.fillText('Personal run · friendly challenge',540,940);
  c.fillStyle='#a8fbef';c.font='700 40px system-ui';c.fillText('Play free in your browser',540,1090);
  c.fillStyle='#ffffff';c.font='600 38px system-ui';c.fillText('earnlyarcade.com/neon-slice.html',540,1170);
  return canvas;
 }
 const api={validScore,target,link,card};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.EarnlyScoreChallenge=api;
})(typeof window!=='undefined'?window:globalThis);
