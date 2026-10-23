"""Finish existing vector wardrobe and create jewelry at fixed 300x400 rig anchors.
Run once on the released wardrobe; finish marker makes subsequent runs idempotent.
"""
from pathlib import Path
import re, math, shutil
ROOT=Path(__file__).resolve().parents[1]
def read(name): return (ROOT/f'cosmetic-{name}.svg').read_text()
def save(name,s):
    p=ROOT/f'cosmetic-{name}.svg'
    p.write_text(s.rstrip()+'\n'); shutil.copy2(p,ROOT/'www'/p.name)
def wrap(art): return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">'+art+'</svg>'
# Replace incomplete torso-only costumes with fully fitted sleeves and trousers.
for name,color in [('pulse-outfit','#70f5dc'),('boardwalk-jacket','#c9a3ed')]:
    if 'wardrobe-finish' in read(name): continue
    s=read('starter-suit').replace('#58e4f5',color)
    if name=='pulse-outfit':
        detail='<path d="M111 205L150 225L190 205M111 212L150 233L190 212" stroke="#78fbe6" stroke-width="3" fill="none"/><path d="M150 236l8 10-8 10-8-10Z" fill="#b0fff1"/>'
    else:
        detail='<path d="M100 177Q86 188 77 215L66 249L84 255L102 211M200 177Q215 187 223 215L234 249L216 255L198 211" fill="#8f76b1" stroke="#263d56" stroke-width="2"/><path d="M78 228l12 4m120 0 12-4" stroke="#d6c6ed" stroke-width="3"/>'
    save(name,s.replace('</svg>',detail+'</svg>'))
# A soft material highlight is clipped to each garment, never painted on bare skin.
outfits=['starter-suit','neon-jacket','cozy-hoodie','storm-coat','solar-jacket','astral-armor','aurora-armor','garden-overalls','petal-dress','moonwalker-suit','royal-petal','pulse-outfit','boardwalk-jacket']
for name in outfits:
    s=read(name)
    if 'wardrobe-finish' in s: continue
    defs='<defs><linearGradient id="wardrobe-satin" x1="0" y1="0" x2="1" y2=".5"><stop stop-color="#fff2dd" stop-opacity=".19"/><stop offset=".42" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#050c20" stop-opacity=".25"/></linearGradient><linearGradient id="wardrobe-fold"><stop stop-color="#fff0e1" stop-opacity=".3"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#080c26" stop-opacity=".3"/></linearGradient></defs>'
    detail='<g id="wardrobe-finish"><path d="M104 181Q150 171 197 181L206 230L211 278Q207 294 201 298Q151 310 99 296Q88 282 91 260L97 215Z" fill="url(#wardrobe-satin)"/><path d="M104 185Q94 215 96 246M198 185Q207 213 205 242" fill="none" stroke="#e9f5fa" stroke-opacity=".2" stroke-width="2" stroke-linecap="round"/><path d="M108 288Q151 301 196 288" fill="none" stroke="#050b19" stroke-opacity=".32" stroke-width="3"/></g>'
    if name in ['petal-dress','royal-petal']:
        detail+='<path d="M120 239L110 292Q125 298 136 298L140 241ZM163 241L167 300Q182 298 196 293L182 239Z" fill="url(#wardrobe-fold)"/>'
    if name=='garden-overalls':
        detail+='<path d="M114 182v27m65-27v27M116 242l8 36m53-36-8 36" stroke="#e7efcf" stroke-opacity=".65" stroke-width="1.5" stroke-dasharray="2 3"/><circle cx="119" cy="211" r="4" fill="#f2ce78" stroke="#776037"/><circle cx="182" cy="211" r="4" fill="#f2ce78" stroke="#776037"/>'
    save(name,s.replace('</svg>',defs+detail+'</svg>'))
# Reuse fitted premium silhouettes for the legacy flat accessories.
for target,source,a,b in [('boardwalk-cap','arcade-cap','#5ca58f','#af86cd'),('nova-crown','sun-crown','#ac733c','#388b8a'),('boardwalk-sneakers','high-tops','#e4ecef','#c7a5eb'),('boardwalk-hair','hair-sweep','#46343b','#715292')]:
    art=read(source).replace(a,b)
    if target=='boardwalk-cap': art=art.replace('M133 39L141 32L151 39L142 47Z','M146 29L136 40L143 40L138 49L153 36L145 36Z')
    save(target,art)
# Individual elliptical links follow a draped chain, with dark occlusion and metal highlights.
def chain(silver=False,pendant=False):
    hi,mid,dark=('#f5fbff','#b9cbd7','#53657b') if silver else ('#fff3b5','#d9ab4e','#755020')
    art=f'<defs><linearGradient id="chain-metal" x2=".4" y2="1"><stop stop-color="{hi}"/><stop offset=".45" stop-color="{mid}"/><stop offset=".7" stop-color="{dark}"/><stop offset="1" stop-color="{hi}"/></linearGradient></defs><path d="M113 179Q119 224 150 231Q182 224 188 179" fill="none" stroke="#07101e" stroke-opacity=".55" stroke-width="8" stroke-linecap="round"/>'
    # Quadratic-like drape, evenly spaced by sampled arc length.
    points=[]; last=None; distance=0
    for i in range(401):
        t=i/400; x=113+75*t; y=180+51*math.sin(math.pi*t)**.82
        if last: distance+=math.hypot(x-last[0],y-last[1])
        if not points or distance>=6:
            points.append((x,y,t));distance=0
        last=x,y
    for i,(x,y,t) in enumerate(points):
        angle=math.degrees(math.atan2(51*.82*math.pi*max(.001,math.sin(math.pi*t))**(-.18)*math.cos(math.pi*t),75))
        art+=f'<ellipse cx="{x:.2f}" cy="{y:.2f}" rx="4.6" ry="2.8" transform="rotate({angle:.1f} {x:.2f} {y:.2f})" fill="none" stroke="{dark}" stroke-width="3.4"/><ellipse cx="{x:.2f}" cy="{y-0.6:.2f}" rx="4.6" ry="2.8" transform="rotate({angle:.1f} {x:.2f} {y-0.6:.2f})" fill="none" stroke="url(#chain-metal)" stroke-width="2"/>'
    if pendant:
        art+='<ellipse cx="150" cy="234" rx="3" ry="5" fill="none" stroke="url(#chain-metal)" stroke-width="3"/><path d="M150 238L162 250L150 265L138 250Z" fill="url(#chain-metal)" stroke="#735329" stroke-width="2"/><path d="M150 243L157 250L150 260L143 250Z" fill="#9aece1"/><path d="M150 243v17l-7-10Z" fill="#eafff5"/><path d="M143 250h14" stroke="#4ca69c" stroke-width="1"/>'
    return wrap(art)
save('silver-chain',chain(True))
save('gold-chain',chain())
save('spud-pendant',chain(pendant=True))
save('no-jewelry',wrap(''))
print('Polished 13 outfits, 4 accessories; generated 3 chains and unequip layer.')
