// One composition order for the studio, profile, and world ranks.
(() => {
  const layers=['backpack','avatar','outfit','shoes','eyes','brows','nose','mouth','marks','hair','face','beard','head','weapon'];
  const defaults={eyes:['eyes-classic','Bright Eyes'],brows:['brows-classic','Friendly Brows'],nose:['nose-classic','Button Nose'],mouth:['mouth-smile','Classic Smile'],marks:['marks-natural','Natural Dimples'],hair:['hair-sprout','Just a Sprout']};
  const bodies=new Set(['cyber-starter','neon-phantom','vortex-mech','astra-prime','russet-potato','cream-potato','rose-potato']);
  function compose(equipped={}) {
    const parts={...equipped};
    // Old clients and saved looks retain their original art. New facial choices switch
    // to the matching blank potato, never paint a second face over the old one.
    if(bodies.has(parts.avatar?.id)&&Object.keys(defaults).some(slot=>parts[slot])) {
      for(const [slot,[id,name]] of Object.entries(defaults))
        parts[slot] ||= {id,name,slot,imageUrl:'cosmetic-'+id+'.svg'};
      parts.avatar={...parts.avatar,imageUrl:'cosmetic-'+parts.avatar.id+'-body.svg'};
    }
    return layers.map(slot=>parts[slot]).filter(Boolean);
  }
  window.EarnlyPotatoRig={layers,compose};
})();
