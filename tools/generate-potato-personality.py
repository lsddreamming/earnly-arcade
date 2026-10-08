"""Add independent facial layers to the existing potato rig; never overwrite legacy faces."""
from pathlib import Path
import runpy, re, json, shutil

ROOT = Path(__file__).resolve().parents[1]
rig = runpy.run_path(str(ROOT / 'tools/generate-cosmetic-art.py'))
svg, mascot, jacket = rig['svg'], rig['mascot'], rig['jacket']
items = []
def add(id, name, slot, art, price=0, starter=False):
    svg(id, art)
    items.append(dict(id=id,name=name,slot=slot,coinPrice=price,rarity='legendary' if price>=600 else 'rare' if price else 'common',imageUrl=f'cosmetic-{id}.svg',isStarter=starter))

palettes=[('cyber-starter','#ffe0a0','#b48150','#62eafa',False),('neon-phantom','#d4b5ff','#7562ad','#bd8bff',False),('vortex-mech','#bdd4db','#667f97','#85acff',True),('astra-prime','#ffe6a3','#c79749','#ffd271',True),('russet-potato','#dfb37c','#805035','#62eafa',False),('cream-potato','#fff0c5','#c9a16b','#62eafa',False),('rose-potato','#edc1a9','#a56c62','#62eafa',False)]
for id,a,b,c,armor in palettes:
    art=mascot(a,b,c,armor)
    # Remove only the baked-in facial features. Preserve silhouette, dimples, sprout and hands.
    blank=re.sub(r'<path d="M113 79.*?/>','',art)
    blank=re.sub(r'<g><ellipse cx="125".*?</g>','',blank)
    for prefix in ('M148 111','M129 139','M134 141'):
        blank=re.sub(r'<path d="'+prefix+r'.*?/>','',blank)
    svg(id+'-body',blank,a,b,c)
    if id.endswith('-potato'):
        svg(id,art,a,b,c)
        items.append(dict(id=id,name=id.split('-')[0].title()+' Potato',slot='avatar',coinPrice=0,rarity='common',imageUrl=f'cosmetic-{id}.svg',isStarter=False))

def eyes(color='#277798',lashes=False,shape='round'):
    art=''
    for x in (125,176):
        if shape=='happy':
            art+=f'<path d="M{x-13} 105Q{x} 83 {x+13} 105" fill="none" stroke="#382b32" stroke-width="5" stroke-linecap="round"/>'
            continue
        ry=17 if shape=='almond' else 21
        art+=f'<ellipse cx="{x}" cy="102" rx="17" ry="{ry}" fill="#fff4df" stroke="#614336" stroke-width="1.5"/><ellipse cx="{x}" cy="104" rx="10" ry="14" fill="{color}"/><ellipse cx="{x}" cy="106" rx="5" ry="9" fill="#101a29"/><circle cx="{x-4}" cy="97" r="4" fill="white"/><circle cx="{x+4}" cy="111" r="1.8" fill="#fff" opacity=".7"/>'
        if lashes: art+=f'<path d="M{x-14} 91l-6-5m10 2-3-7m26 10 6-5" stroke="#382b32" stroke-width="2.5" stroke-linecap="round"/>'
    return art
for id,name,color,lash,shape in [('eyes-classic','Bright Eyes','#277798',False,'round'),('eyes-hazel','Hazel Eyes','#a66a32',False,'round'),('eyes-green','Clover Eyes','#47906c',False,'round'),('eyes-lashes','Soft Lashes','#7963a6',True,'almond'),('eyes-happy','Happy Eyes','#277798',False,'happy'),('eyes-amber','Amber Lashes','#ba863d',True,'round')]:
    add(id,name,'eyes',eyes(color,lash,shape),starter=id=='eyes-classic')
add('eyes-galaxy','Galaxy Eyes','eyes',eyes('#9668ec',True)+'<g fill="#fff1a9"><path d="M125 91l2 7 7 2-7 2-2 7-2-7-7-2 7-2ZM176 91l2 7 7 2-7 2-2 7-2-7-7-2 7-2Z"/></g>',500)
for id,name,d,width in [('brows-classic','Friendly Brows','M113 79Q125 73 136 80M165 80Q177 73 188 79',5),('brows-soft','Soft Arches','M112 77Q125 68 138 77M163 77Q176 68 189 77',3),('brows-bold','Bold Brows','M111 77L137 78M164 78L190 77',7),('brows-curious','Curious Brows','M113 78Q125 68 137 76M165 72Q177 61 189 68',4),('brows-daring','Daring Brows','M113 73L137 81M164 81L188 73',4),('brows-none','No Brows','',0)]:
    add(id,name,'brows',f'<path d="{d}" fill="none" stroke="#59352c" stroke-width="{width}" stroke-linecap="round"/>',starter=id=='brows-classic')
for id,name,art in [
 ('mouth-smile','Classic Smile','<path d="M129 139Q150 154 174 137Q162 163 143 156Z" fill="#452d2c"/><path d="M134 141Q151 149 168 140L165 145Q151 151 137 146Z" fill="#fff1cf"/>'),
 ('mouth-grin','Big Grin','<path d="M126 138Q150 144 178 136Q169 164 149 161Q134 159 126 138Z" fill="#57313a"/><path d="M129 140Q151 146 175 139L170 149Q150 155 134 148Z" fill="#fff6e0"/>'),
 ('mouth-soft','Soft Smile','<path d="M134 143Q152 155 170 141" fill="none" stroke="#663b39" stroke-width="3.5" stroke-linecap="round"/>'),
 ('mouth-rose','Rose Smile','<path d="M131 142Q141 136 151 141Q160 134 173 140Q158 158 144 153Z" fill="#ae5269"/><path d="M136 143Q151 148 168 142" fill="none" stroke="#65333d" stroke-width="2"/>'),
 ('mouth-wow','Little Wow','<ellipse cx="151" cy="146" rx="8" ry="11" fill="#563139"/><ellipse cx="152" cy="152" rx="5" ry="3" fill="#d88789"/>'),
 ('mouth-smirk','Cheeky Smirk','<path d="M134 147Q155 150 172 138M171 135l4 6" fill="none" stroke="#663b39" stroke-width="3" stroke-linecap="round"/>')]:
    add(id,name,'mouth',art,starter=id=='mouth-smile')
add('mouth-vampire','Tiny Fangs','mouth','<path d="M129 139Q150 151 174 137Q162 163 143 156Z" fill="#452d2c"/><path d="M136 143l6 13 5-11m10-1 5 11 6-14" fill="#fff9e9"/>',250)
for id,name,art in [('nose-classic','Button Nose','<path d="M148 111Q137 127 151 130Q160 130 157 121" fill="#bd8b62" stroke="#85573b" stroke-width="1.5"/>'),('nose-round','Round Nose','<ellipse cx="151" cy="124" rx="10" ry="8" fill="#c89572" stroke="#805b43" stroke-width="1.5"/><path d="M146 121q4-4 8-1" fill="none" stroke="#f3cfaa" stroke-width="2"/>'),('nose-tiny','Tiny Nose','<path d="M147 124q4 5 9 0" fill="none" stroke="#85573b" stroke-width="2.5" stroke-linecap="round"/>'),('nose-freckle','Freckled Nose','<path d="M146 115Q139 129 152 130Q162 128 156 118" fill="#c89572"/><g fill="#835c43"><circle cx="148" cy="122" r="1.3"/><circle cx="154" cy="124" r="1.3"/></g>')]:
    add(id,name,'nose',art,starter=id=='nose-classic')
add('hair-sprout','Just a Sprout','hair','',starter=True)
hair_shapes=[('hair-bob','Chestnut Bob','M83 110Q65 54 105 30Q155 8 198 35Q232 58 218 140L199 155L205 77Q168 76 139 48Q120 76 93 82L99 151L79 140Z','#624034'),('hair-sweep','Side Sweep','M85 81Q72 37 118 25Q174 8 206 46L213 81Q175 66 161 46Q130 85 85 81Z','#46343b'),('hair-ponytail','Golden Ponytail','M207 58Q250 30 252 69Q265 100 239 137L225 118Q240 84 213 82Z M84 79Q75 31 121 27Q180 8 209 55L211 76Q174 73 148 45Q116 74 84 79Z','#be8950'),('hair-curls','Cocoa Curls','M84 87Q65 78 76 60Q66 36 91 33Q96 12 118 22Q141 6 154 21Q178 9 191 29Q217 24 223 47Q242 65 218 85L201 75Q177 81 161 58Q139 76 119 65Q101 91 84 87Z','#3f3030'),('hair-waves','Rose Waves','M89 87Q69 47 105 30Q153 9 195 36Q226 55 216 91L224 133L213 162L201 145L205 77Q170 69 151 47Q128 77 96 88L101 147L85 163L75 141Z','#a85e70')]
for id,name,path,color in hair_shapes:
    add(id,name,'hair',f'<path d="{path}" fill="{color}" stroke="#382c35" stroke-width="2.5"/><path d="M99 52Q127 26 155 32" fill="none" stroke="#ffe0bc" opacity=".25" stroke-width="4" stroke-linecap="round"/>')
add('hair-aurora','Aurora Waves','hair',f'<path d="{hair_shapes[-1][2]}" fill="#626bc5" stroke="#b6f7ef" stroke-width="2"/><path d="M88 70Q106 27 147 34M207 97l5 40M86 97l-3 41" fill="none" stroke="#7be6cc" stroke-width="6"/><path d="M102 56Q123 35 145 37" fill="none" stroke="#e0bbff" stroke-width="5"/>',650)
add('marks-natural','Natural Dimples','marks','',starter=True)
add('marks-freckles','Extra Freckles','marks','<g fill="#795039" opacity=".7">'+''.join(f'<circle cx="{x}" cy="{y}" r="1.7"/>' for x,y in [(103,119),(110,115),(116,122),(105,126),(190,120),(197,115),(203,123),(196,128)])+'</g>')
add('marks-blush','Rosy Cheeks','marks','<g fill="#d97786" opacity=".5"><ellipse cx="107" cy="127" rx="12" ry="6"/><ellipse cx="196" cy="127" rx="12" ry="6"/></g>')
add('marks-heart','Heart Sticker','marks','<path d="M194 132L184 123Q182 114 189 114Q194 114 194 119Q195 113 201 114Q209 117 203 124Z" fill="#e879a3" stroke="#ffd9dd" stroke-width="1"/>')
add('marks-starlight','Starlight Freckles','marks','<g fill="#ffe29a" stroke="#fff6d9" stroke-width=".7"><path d="M106 114l2 5 6 1-5 3 1 6-4-4-5 3 1-6-4-3 6-1ZM196 114l2 5 6 1-5 3 1 6-4-4-5 3 1-6-4-3 6-1Z"/></g>',350)
add('garden-overalls','Garden Overalls','outfit',jacket('#98c998')+'<path d="M112 180v59h77v-59l-14-7v42h-49v-41Z" fill="#789e95" stroke="#cfdec0" stroke-width="2"/><rect x="135" y="226" width="31" height="23" rx="5" fill="#577b78" stroke="#d7dfb1"/><circle cx="119" cy="211" r="3" fill="#ffe2a2"/><circle cx="182" cy="211" r="3" fill="#ffe2a2"/>')
add('petal-dress','Petal Dress','outfit',jacket('#e5a4c7')+'<path d="M108 212Q150 226 197 212L217 293Q150 324 86 293Z" fill="#b375a5" stroke="#f6c9df" stroke-width="2"/><path d="M102 239Q150 250 204 239M94 278Q153 298 209 278" fill="none" stroke="#efb9d4" stroke-width="3"/><path d="M149 231l-14-7v15l14-7 15 7v-15Z" fill="#ffe0a6"/>')
add('moonwalker-suit','Moonwalker Suit','outfit',jacket('#e5f7ff',armored=True)+'<path d="M108 200L193 200L202 278L99 278Z" fill="#dae8ed" stroke="#9bb7c9" stroke-width="3"/><rect x="125" y="216" width="49" height="37" rx="8" fill="#263f5d"/><circle cx="137" cy="229" r="4" fill="#6de7df"/><path d="M149 226h16m-16 8h12" stroke="#ffd185" stroke-width="3"/><path d="M110 280h82" stroke="#8fe3fa" stroke-width="6"/>',800)
add('royal-petal','Royal Petal','outfit',jacket('#dfbdf8')+'<path d="M105 206L194 206L221 294Q151 329 81 294Z" fill="#635085" stroke="#e9c681" stroke-width="3"/><path d="M112 216L96 287M188 216L205 287M150 224V308" stroke="#be9dc8" stroke-width="3"/><path d="M140 219L151 208L162 219L151 234Z" fill="#b5efef" stroke="#ffe3a0" stroke-width="2"/><path d="M89 293Q150 318 213 293" fill="none" stroke="#ffe0a2" stroke-width="4"/>',900)
add('no-handheld','Empty Hands','weapon','')

(ROOT/'potato-personality-catalog.json').write_text(json.dumps(items,indent=2)+'\n')
for item in items:
    shutil.copy2(ROOT/item['imageUrl'],ROOT/'www'/item['imageUrl'])
for id,*_ in palettes:
    shutil.copy2(ROOT/f'cosmetic-{id}-body.svg',ROOT/'www'/f'cosmetic-{id}-body.svg')
print(f'Personality collection: {len(items)} items, {sum(i["coinPrice"]==0 for i in items)} free.')
