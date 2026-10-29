import type {SpudId} from './spud-residents.ts';
export type ResidentHomeFacts={residentId:SpudId;roomId:string;name:string;items:string[];animatedFish:boolean};
// Stable, system-owned showcase rooms. Catalog scenery is never minted into inventory.
export const RESIDENT_HOMES=[
 ['jax',"Jax's Laugh Lounge",'sunset-sofa','mint-rug','retro-tv','arcade-cabinet','pixel-speaker','espresso-bar'],
 ['blitz',"Blitz's Bonus Round",'mint-sofa','pixel-dance','arcade-cabinet','pixel-pinball','home-computer','collector-orrery'],
 ['mochi',"Mochi's Quiet Cove",'rose-sofa','lavender-rug','tea-trolley','rolltop-desk','zen-bonsai','oak-bookshelf'],
 ['zippy',"Zippy's Spark Studio",'sunset-sofa','pixel-dance','pixel-speaker','arcade-cabinet','flower-pot','pixel-pinball'],
 ['fern',"Sprout's Leafy Retreat",'mint-sofa','mint-rug','zen-pond','zen-bonsai','flower-pot','ficus-tree'],
 ['nova',"Nova's Starry Nook",'rose-sofa','lavender-rug','collector-orrery','collector-gallery','home-computer','rolltop-desk'],
 ['pip',"Pixel's Color Workshop",'rose-sofa','mint-rug','maker-bench','maker-easel','flower-pot','collector-gallery'],
 ['rio',"Rio's Rhythm Room",'ruby-sofa','pixel-dance','pixel-speaker','retro-tv','pixel-speaker','espresso-bar'],
 ['sage',"Sage's Reading Hideaway",'mint-sofa','lavender-rug','rolltop-desk','oak-bookshelf','zen-bonsai','tea-trolley'],
 ['bea',"Bea's Curiosity Corner",'ruby-sofa','mint-rug','collector-gallery','collector-orrery','zen-bonsai','maker-bench']
].map(([residentId,name,sofa,rug,...special],i)=>({residentId:residentId as SpudId,name,roomId:`ead10000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,size:14,items:[
 ['linen-platform',1,1],['lunar-nightstand',3,1],['collector-aquarium',8,1],['oak-bookshelf',1,5],
 [sofa,3,6],['sage-chair',6,7],['low-table',4,8],[rug,3,9],['neon-lamp',6,5],['ficus-tree',11,3],['flower-pot',11,11],
 ...special.map((id,j)=>[id,...[[8,5],[8,8],[11,7],[1,10]][j]])
 ].map(([definitionId,x,y],j)=>({id:`home-${residentId}-${j}`,definitionId:String(definitionId),x:Number(x),y:Number(y),rotation:0}))}));
export const residentHome=(roomId:string)=>RESIDENT_HOMES.find(h=>h.roomId===roomId);
export function validatedHomeFacts(value:unknown):ResidentHomeFacts[]{
 if(!Array.isArray(value))return [];
 return value.flatMap(v=>{const home=v&&residentHome(v.roomId);return home&&v.residentId===home.residentId&&typeof v.name==='string'&&Array.isArray(v.items)?[{residentId:home.residentId,roomId:home.roomId,name:v.name.slice(0,40),items:v.items.filter((s:unknown)=>typeof s==='string').slice(0,20).map((s:string)=>s.slice(0,64)),animatedFish:v.animatedFish===true}]:[];});
}
