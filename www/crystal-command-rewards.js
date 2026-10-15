/* Completed battle rewards use the same authenticated wallet as the arcade,
   avatar shop and World furniture. No rewards for lessons or early endings. */
window.CrystalRewards={
 result(view,side){
  if(!view?.ended||view.learning||view.winner!==side||view.reason!=='All enemy structures destroyed'||view.time<60||view.player?.kills<1)return null;
  const metric=Math.min(10000,Math.max(0,Math.floor(view.player.kills))),aux=Math.min(10000,Math.max(0,Math.floor(view.time)));
  if(!Number.isFinite(metric)||!Number.isFinite(aux))return null;
  return {metric,aux,coins:10+Math.min(15,Math.floor(metric/3))};
 }
};
