/** The bundled iOS web view has this fixed origin. JWT and room authorization
 * still apply to every connection; never accept null, wildcards or arbitrary schemes. */
export function worldOrigins(config:string):ReadonlySet<string>{
 const origins=new Set(config.split(',').map(s=>s.trim()).filter(Boolean));
 if(!origins.size)throw new Error('An explicit origin allowlist is required');
 for(const origin of origins){
  if(origin==='capacitor://localhost')continue;
  const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin)throw new Error('Invalid World origin');
 }
 origins.add('capacitor://localhost');
 return origins;
}
