import {Capacitor,registerPlugin} from '@capacitor/core';
const game=registerPlugin('AlienInvasion');
const button=document.getElementById('launchNativeAR');
if(button){
  button.addEventListener('click',async()=>{
    const status=document.getElementById('nativeARStatus');
    if(!Capacitor.isNativePlatform()||!Capacitor.isPluginAvailable('AlienInvasion')){
      status.textContent='This game needs the Earnly Arcade AR TestFlight build. It cannot start room tracking in Safari.';return;
    }
    button.disabled=true;status.textContent='Opening room-tracked AR…';
    try {await game.open();status.textContent='AR game opened. Exit returns you to Earnly Arcade.';}
    catch(error){status.textContent=error?.message||'AR could not start. Try again.';}
    finally{button.disabled=false;}
  });
}
