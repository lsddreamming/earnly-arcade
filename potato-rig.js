// One composition order for the studio, profile, and world ranks.
(() => {
  const layers=['backpack','avatar','outfit','jewelry','shoes','eyes','brows','nose','mouth','marks','hair','face','beard','head','weapon','pet','frame','pose','effect'];
  const defaults={eyes:['eyes-classic','Bright Eyes'],brows:['brows-classic','Friendly Brows'],nose:['nose-classic','Button Nose'],mouth:['mouth-smile','Classic Smile'],marks:['marks-natural','Natural Dimples'],hair:['hair-sprout','Just a Sprout']};
  const bodies=new Set(['cyber-starter','neon-phantom','vortex-mech','astra-prime','russet-potato','cream-potato','rose-potato']);
  function compose(equipped={}) {
    const parts={...equipped};
    // Legacy bare looks keep their baked-in face. Facial choices or headwear use
    // separate layers so features do not double up and sprouts can fit under hats.
    if(bodies.has(parts.avatar?.id)&&(Object.keys(defaults).some(slot=>parts[slot]) || (parts.head && parts.head.id !== 'no-headwear'))) {
      for(const [slot,[id,name]] of Object.entries(defaults))
        parts[slot] ||= {id,name,slot,imageUrl:'cosmetic-'+id+'.svg'};
      if (['arcade-cap','ribbed-beanie','sun-crown','boardwalk-cap','nova-crown'].includes(parts.head?.id) && parts.hair?.id === 'hair-sprout') delete parts.hair;
      if (['nose-classic','nose-round','nose-tiny','nose-freckle'].includes(parts.nose?.id))
        parts.nose={...parts.nose,imageUrl:'cosmetic-'+parts.nose.id+'-'+parts.avatar.id+'.svg'};
      parts.avatar={...parts.avatar,imageUrl:'cosmetic-'+parts.avatar.id+'-body.svg'};
    }
    return layers.map(slot=>parts[slot]).filter(Boolean);
  }
  window.EarnlyPotatoRig={layers,compose};
})();
