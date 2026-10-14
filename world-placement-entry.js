import {RoomGrid,parseHeightmap} from './world-server/src/grid.ts';

// Preview uses the same geometry as the server; the server still authorizes every drop.
export function placementCheck(scene,item,position,users=[]){
 try{
  const floor=parseHeightmap(scene.heightmap),items=scene.items.filter(i=>i.id!==item.id);
  const base=new RoomGrid(floor,items),tile=base.tile(position);
  if(!tile)throw new Error('Choose a floor tile');
  const placed={...item,...position,z:tile.z};
  const next=new RoomGrid(floor,[...items,placed]);
  for(const user of users){const t=next.tile(user.position);if(!t||t.z!==user.position.z||!(t.walkable||user.state==='sit'&&t.canSit||user.state==='lay'&&t.canLay))throw new Error('Move away from the item before placing it');}
  return {valid:true,z:tile.z};
 }catch(error){return {valid:false,z:0,reason:error.message};}
}
