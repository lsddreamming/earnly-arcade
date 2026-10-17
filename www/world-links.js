(()=>{'use strict';
 const valid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
 const room=new URLSearchParams(location.search).get('room');
 const returnRoom=new URLSearchParams(location.search).get('worldRoom');
 window.EarnlyWorldLinks={room:valid(room)?room:null,
  signIn:()=>valid(room)?'account.html?worldRoom='+encodeURIComponent(room):'account.html',
  afterSignIn:()=>valid(returnRoom)?'world.html?room='+encodeURIComponent(returnRoom):'index.html',
  shareURL:id=>{if(!valid(id))throw new Error('Room link unavailable.');return 'https://earnlyarcade.com/world.html?room='+encodeURIComponent(id);}
 };
})();
