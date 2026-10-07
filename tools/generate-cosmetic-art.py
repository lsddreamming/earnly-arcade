"""Original Arcade Sprout vector rig: all layers share a 300 × 400 canvas.

No external characters, fonts, or image dependencies. Keep attachment positions
stable when adding new items so existing players can mix every equipment slot.
"""
from pathlib import Path
from random import Random

ROOT = Path(__file__).resolve().parents[1]

def svg(name, art, a='#eac086', b='#93603e', accent='#58e4f5'):
    defs = f'''<defs>
    <radialGradient id="skin" cx=".32" cy=".2" r=".85"><stop stop-color="{a}"/><stop offset=".55" stop-color="{b}"/><stop offset="1" stop-color="#392b37"/></radialGradient>
    <linearGradient id="cloth" x2=".8" y2="1"><stop stop-color="#3d5b75"/><stop offset=".5" stop-color="#253648"/><stop offset="1" stop-color="#101b2d"/></linearGradient>
    <linearGradient id="fabric" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="{accent}"/><stop offset=".3" stop-color="#46647a"/><stop offset="1" stop-color="#18283d"/></linearGradient>
    <linearGradient id="hood" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="{accent}"/><stop offset=".55" stop-color="#675877"/><stop offset="1" stop-color="#283549"/></linearGradient>
    <linearGradient id="metal" x2=".75" y2="1"><stop stop-color="#dce6e9"/><stop offset=".3" stop-color="#7e98ac"/><stop offset=".48" stop-color="#e1e9eb"/><stop offset=".55" stop-color="#496477"/><stop offset="1" stop-color="#192c40"/></linearGradient>
    <linearGradient id="trim" x2="1" y2="1"><stop stop-color="#edfcff"/><stop offset=".4" stop-color="{accent}"/><stop offset="1" stop-color="#287c9f"/></linearGradient>
    <linearGradient id="leather" x2=".8" y2="1"><stop stop-color="#c59269"/><stop offset=".5" stop-color="#855339"/><stop offset="1" stop-color="#392722"/></linearGradient>
    <linearGradient id="hair" x2=".3" y2="1"><stop stop-color="#8f5a36"/><stop offset=".6" stop-color="#492b25"/><stop offset="1" stop-color="#241b22"/></linearGradient>
    <radialGradient id="lens" cx=".3" cy=".15"><stop stop-color="#84d9ef"/><stop offset=".6" stop-color="#153e64"/><stop offset="1" stop-color="#09182b"/></radialGradient>
    </defs>'''
    # Keep unused material gradients out of unrelated assets.
    for material in ('fabric', 'hood'):
        if f'url(#{material})' not in art:
            import re
            defs = re.sub(r'    <linearGradient id="'+material+r'".*?</linearGradient>\n', '', defs)
    (ROOT / ('cosmetic-'+name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">{defs}{art}</svg>\n')

# Broad silhouette, asymmetry, skin dimples, catchlights and articulated hands.
def mascot(a,b,accent,armor=False):
    art = '''<ellipse cx="150" cy="379" rx="74" ry="11" fill="#020916" opacity=".6"/>
    <g stroke="#493039" stroke-width="2" stroke-linejoin="round">
    <path d="M118 276Q99 316 109 353L136 354L145 283Z" fill="url(#skin)"/>
    <path d="M160 279L165 353L194 353Q201 318 182 278Z" fill="url(#skin)"/>
    <path d="M95 191Q68 194 65 224L58 262Q48 280 64 287Q79 295 90 276L101 235Z" fill="url(#skin)"/>
    <path d="M199 191Q222 194 225 226L235 259Q249 274 236 288Q223 297 211 276L199 236Z" fill="url(#skin)"/>
    <path d="M94 184Q106 163 148 162Q191 163 204 189L213 264Q205 302 152 307Q101 304 87 270Z" fill="url(#skin)"/>
    <path d="M85 101Q76 59 106 39Q137 19 176 33Q203 33 215 63Q232 90 212 130Q214 151 189 171Q158 190 119 171Q84 155 85 101Z" fill="url(#skin)"/>
    </g>'''
    r=Random(21)
    for _ in range(72):
        x=r.randint(92,207); y=r.randint(43,158)
        if (x-150)**2/66**2+(y-103)**2/75**2 > .88 or (110<x<190 and 77<y<143): continue
        art+=f'<ellipse cx="{x}" cy="{y}" rx="{r.uniform(1,2.5):.1f}" ry="{r.uniform(1,2):.1f}" fill="#59392d" opacity=".3"/><path d="M{x-2} {y+2}l3 0" stroke="{a}" opacity=".5"/>'
    art+='''<path d="M100 70Q99 52 121 45" stroke="#fff6d9" opacity=".38" stroke-width="7" stroke-linecap="round" fill="none"/>
    <ellipse cx="111" cy="126" rx="12" ry="6" fill="#dc785e" opacity=".35"/><ellipse cx="192" cy="126" rx="12" ry="6" fill="#dc785e" opacity=".3"/>
    <path d="M113 79Q125 73 136 80M165 80Q177 73 188 79" fill="none" stroke="#59352c" stroke-width="5" stroke-linecap="round"/>
    <g><ellipse cx="125" cy="102" rx="17" ry="21" fill="#fff4d9"/><ellipse cx="176" cy="102" rx="17" ry="21" fill="#fff4d9"/>
    <ellipse cx="128" cy="104" rx="10" ry="14" fill="url(#lens)"/><ellipse cx="173" cy="104" rx="10" ry="14" fill="url(#lens)"/>
    <ellipse cx="130" cy="107" rx="5" ry="9" fill="#071222"/><ellipse cx="172" cy="107" rx="5" ry="9" fill="#071222"/>
    <circle cx="125" cy="98" r="4" fill="white"/><circle cx="168" cy="98" r="4" fill="white"/></g>
    <path d="M148 111Q137 127 151 130Q160 130 157 121" fill="url(#skin)" stroke="#85573b" stroke-width="1.5"/>
    <path d="M129 139Q150 154 174 137Q162 163 143 156Z" fill="#452d2c"/>
    <path d="M134 141Q151 149 168 140L165 145Q151 151 137 146Z" fill="#fff1cf"/>
    <path d="M64 271l-2 9m9-8-1 10m158-8 3 9m-12-11 3 13" stroke="#68433a" stroke-width="2" stroke-linecap="round"/>
    <path d="M139 39Q143 22 154 20Q152 31 145 40" fill="#66a784" stroke="#315e58" stroke-width="2"/>
    <path d="M143 33Q126 20 121 25Q128 36 142 40" fill="#a1c99a" stroke="#315e58" stroke-width="2"/>'''
    if armor:
        art+=f'<path d="M91 61Q108 30 142 31L151 44L162 31Q193 33 211 61L198 73L151 58L101 77Z" fill="url(#metal)" stroke="#233d52" stroke-width="2"/><path d="M109 53L135 42m31 0 27 11" stroke="{accent}" stroke-width="3"/><circle cx="151" cy="46" r="5" fill="{accent}"/>'
    return art

for name,a,b,c,armor in [('cyber-starter','#ffe0a0','#b48150','#62eafa',False),('neon-phantom','#d4b5ff','#7562ad','#bd8bff',False),('vortex-mech','#bdd4db','#667f97','#85acff',True),('astra-prime','#ffe6a3','#c79749','#ffd271',True)]:
    svg(name,mascot(a,b,c,armor),a,b,c)

def jacket(color='#58e4f5', hoodie=False, armored=False):
    # Closed contours overlap the full body/upper arm silhouette by 3–6 units.
    # Only the hands and face remain exposed; every outfit uses this same rig.
    art=f'''<g stroke="#122335" stroke-width="2.5" stroke-linejoin="round">
    <path d="M107 278Q150 271 193 278L201 342L165 347L151 306L137 347L100 342Z" fill="url(#cloth)"/>
    <path d="M103 173Q82 175 70 199Q63 221 57 254L88 264L105 221ZM197 173Q220 175 228 201L240 254L210 264L194 221Z" fill="url(#cloth)"/>
    <path d="M103 173Q122 163 150 166Q178 164 198 173L209 211L217 266Q216 288 207 300Q152 317 93 300Q83 287 83 265L91 211Z" fill="url(#cloth)"/>
    </g>
    <path d="M104 175Q110 202 97 232L92 279M197 175Q188 202 204 232L209 279" fill="none" stroke="#668096" stroke-width="1.4"/>
    <path d="M105 180L133 189L150 180L168 189L196 180L193 194L168 206L150 192L133 206L108 194Z" fill="#142b41" stroke="{color}" stroke-width="2"/>
    <path d="M103 199Q91 210 92 230M198 199Q210 214 208 230M72 219l15 6m131-6-12 6" fill="none" stroke="#a4bdd0" opacity=".28" stroke-width="2"/>
    <path d="M103 283Q151 300 207 283L205 298Q151 314 94 297L94 282Z" fill="#15273c"/>
    <path d="M96 296Q152 311 207 296" fill="none" stroke="{color}" stroke-width="2.5"/>
    <path d="M151 203V298" stroke="#081a2a" stroke-width="6"/><path d="M150 203V297" stroke="#adc1cd" stroke-width="1.6"/>
    <path d="M108 254L135 256L132 283L108 279ZM165 256L196 254L194 279L169 283Z" fill="#172a3d" stroke="#607e94" stroke-width="1.5"/>
    <path d="M108 255l27 2m31 0 29-2" stroke="{color}" stroke-width="1"/>
    <path d="M114 260l16 1m42 0 17-1" stroke="#b7c6cf" opacity=".35" stroke-dasharray="1 2"/>
    <rect x="147" y="217" width="7" height="11" rx="2" fill="url(#metal)" stroke="#1c3347"/>
    <path d="M113 216L134 218L132 240L117 241Z" fill="#123c50" stroke="{color}" stroke-width="1.2"/><path d="M118 222l10 1m-9 5 7 1" stroke="{color}" stroke-width="2"/>
    <circle cx="121" cy="236" r="1.5" fill="#d8f5ff"/>
    <path d="M58 247L89 256L87 265L56 256ZM209 256L239 247L242 256L211 265Z" fill="#182b3e" stroke="#354c63" stroke-width="1.4"/>
    <path d="M59 252L86 260M212 260L238 252" stroke="{color}" stroke-width="2.5"/>
    <path d="M101 211L91 262M198 211L208 262M111 310L106 335M189 310L194 335" fill="none" stroke="#dce8ed" opacity=".25" stroke-dasharray="1 3"/>
    <path d="M110 307L135 311L129 331L106 328ZM165 311L190 307L195 328L172 331Z" fill="#1c3045" stroke="#425b72" stroke-width="1.3"/>
    <path d="M109 319l21 3m43 0 20-3" stroke="#8ca4b5" opacity=".4"/>
    <path d="M116 246l13 2m46 0 13-2M110 289l20 4m44 0 19-4" stroke="#7a94a8" opacity=".22" stroke-width="2"/>'''
    if hoodie:
        art+=f'''<path d="M103 178Q89 157 109 157Q150 183 191 157Q211 157 199 178L175 199L150 185L125 199Z" fill="url(#hood)" stroke="#293c50" stroke-width="2.5"/>
        <path d="M106 162Q151 193 193 162" fill="none" stroke="{color}" opacity=".7" stroke-width="2"/>
        <path d="M108 171L124 190L149 180L175 190L193 171" fill="none" stroke="#13263a" opacity=".5" stroke-width="3"/>
        <path d="M127 191v34m46-34v34" stroke="#192a3b" stroke-width="4"/><path d="M127 191v32m46-32v32" stroke="#eee1cc" stroke-width="1.8"/>
        <rect x="125" y="220" width="4" height="9" rx="1" fill="url(#metal)"/><rect x="171" y="220" width="4" height="9" rx="1" fill="url(#metal)"/>
        <path d="M113 254Q150 245 189 254L191 282Q151 294 110 281Z" fill="url(#fabric)" stroke="#55748a" stroke-width="1.6"/>
        <path d="M115 256Q151 249 187 256M113 279Q151 289 189 280" fill="none" stroke="#c5d2da" opacity=".45" stroke-dasharray="1 2"/>
        <path d="M125 258l-7 19m58-19 8 19" stroke="#152d40" stroke-width="3"/>
        <path d="M117 234l9 5m49 0 10-5" stroke="{color}" opacity=".4" stroke-width="1.4"/>'''
    if armored:
        art+='''<path d="M102 184L127 196L150 185L175 196L200 184L205 244L178 271L123 271L97 244Z" fill="url(#metal)" stroke="#253e54" stroke-width="3"/>
        <path d="M112 201L150 218L189 201L183 247L150 261L119 247Z" fill="#132d43" stroke="#d9a957" stroke-width="2.5"/>
        <path d="M114 202L125 244L150 255L178 244L186 203" fill="none" stroke="#fff0bd" opacity=".5"/>
        <path d="M150 222L160 235L150 248L140 235Z" fill="#ffe4a0" stroke="#bf8b42"/>
        <path d="M78 182L102 174L111 208L69 221ZM198 174L222 182L231 221L189 208Z" fill="url(#metal)" stroke="#e8c980" stroke-width="2.5"/>
        <path d="M81 189L97 183L101 203L76 211M203 183L219 189L225 211L198 203" fill="none" stroke="#263d52" stroke-width="3"/>
        <path d="M103 279L129 284L130 297L100 293ZM171 284L200 279L204 293L172 297Z" fill="url(#metal)" stroke="#354b5e"/>
        <circle cx="106" cy="220" r="3" fill="#ffe8ad"/><circle cx="196" cy="220" r="3" fill="#ffe8ad"/>
        <path d="M118 314L132 316L128 333L110 330ZM168 316L184 314L192 330L172 333Z" fill="url(#metal)" stroke="#35516b"/>
        <path d="M64 238L87 244L83 253L62 247M214 244L236 238L238 247L217 253" fill="url(#metal)" stroke="#35516b"/>'''
    return art

svg('starter-suit',jacket())
svg('neon-jacket',jacket('#b899ff',True),accent='#b899ff')
svg('astral-armor',jacket('#ffd271',armored=True),accent='#ffd271')
svg('cozy-hoodie',jacket('#c49778',True),accent='#c49778')

def shoes(kind='boots',accent='#7ae4eb'):
    fill='url(#leather)' if kind=='boots' else 'url(#cloth)'
    return f'''<g stroke="#1a2535" stroke-width="2"><path d="M108 336L135 339L137 359Q147 370 132 375H93Q88 368 94 358L104 355Z" fill="{fill}"/>
    <path d="M166 339L193 336L197 355L209 359Q215 369 209 375H170Q156 371 164 359Z" fill="{fill}"/></g>
    <path d="M91 368H140M163 368H212" stroke="#e1d9c6" stroke-width="6" stroke-linecap="round"/>
    <path d="M108 346L129 349M106 352L128 355M173 349L191 346M172 355L192 352" stroke="{accent}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M98 359Q116 361 134 359M171 359Q189 361 205 359" fill="none" stroke="#fff" opacity=".25"/>
    <path d="M104 338L107 346L129 349L132 341M170 341L174 349L190 346L194 338" fill="none" stroke="#efcfad" opacity=".5" stroke-width="1.2"/>
    <path d="M96 361Q111 365 132 362M171 362Q192 365 208 361" fill="none" stroke="#182538" stroke-width="2"/>
    <path d="M96 369v3m7-3v3m7-3v3m7-3v3m7-3v3m7-3v3m43-3v3m7-3v3m7-3v3m7-3v3m7-3v3m7-3v3" stroke="#73808c" stroke-width="1"/>
    <path d="M101 359L105 339M195 339L200 359" stroke="#f5dec4" opacity=".4" stroke-dasharray="1 2"/>
    <path d="M94 375H135M170 375H210" stroke="#263140" stroke-width="3"/>
    <path d="M101 365l4-3m26 0 4 3m37 0 4-3m24 0 4 3" stroke="{accent}" stroke-width="2"/>'''
svg('trail-boots',shoes())
svg('canvas-shoes',shoes('sneakers','#f5d7ad'))
svg('neon-kicks',shoes('sneakers','#c599ff'),accent='#c599ff')

svg('no-backpack','')
svg('no-beard','')
svg('no-facewear','')
svg('canvas-pack','''<g stroke="#3b3034" stroke-width="2"><path d="M85 172Q63 160 56 192L48 245Q46 265 76 274L95 259L110 183Z" fill="url(#leather)"/><path d="M204 171Q229 164 237 192L249 245Q251 265 221 274L204 258L189 183Z" fill="url(#leather)"/>
<path d="M65 187L54 239L80 248L98 185ZM203 185L221 248L245 239L231 187Z" fill="#b79464"/>
<path d="M58 224L85 231L79 253L53 245ZM218 231L243 224L249 245L224 253Z" fill="#724b35"/>
<path d="M71 230l-4 16m162-16 4 16" stroke="#ead7a6" stroke-width="4"/>
<path d="M76 171L63 171L54 199M227 171L238 177L245 202" fill="none" stroke="#debe91" stroke-width="5"/></g>''')
svg('reactor-pack','''<g stroke="#142c49" stroke-width="2"><rect x="46" y="174" width="38" height="104" rx="17" fill="url(#metal)" transform="rotate(8 65 226)"/><rect x="217" y="174" width="38" height="104" rx="17" fill="url(#metal)" transform="rotate(-8 236 226)"/><path d="M60 180L47 153L64 148L80 180M224 180L235 148L252 153L240 182" fill="#334f68"/>
<rect x="58" y="190" width="13" height="64" rx="6" fill="url(#trim)"/><rect x="229" y="190" width="13" height="64" rx="6" fill="url(#trim)"/><path d="M60 277L65 306L72 277M230 277L237 306L242 277" fill="#66e6fa" opacity=".8"/><path d="M49 207h30m-32 28h31m-30 25h29m139-53h29m-30 28h32m-30 25h31" stroke="#23435d" stroke-width="3"/></g>''')

svg('round-glasses','''<g fill="none" stroke="#dbb984" stroke-width="4"><circle cx="125" cy="104" r="22"/><circle cx="176" cy="104" r="22"/><path d="M146 101Q151 96 155 101M103 103L88 98M198 103L213 98"/></g><path d="M110 94l8-7m50 7 8-7" stroke="#fff" stroke-width="3" opacity=".65"/>''')
svg('sport-shades','''<path d="M101 85L145 88L147 111Q126 133 106 115ZM155 88L200 85L195 115Q177 133 153 112Z" fill="url(#lens)" stroke="#8198a8" stroke-width="3"/><path d="M144 96H156M102 94L88 88M199 94L213 88" stroke="#92aab7" stroke-width="5"/><path d="M111 92L131 96M166 97L188 92" stroke="#89e5ee" stroke-width="3" opacity=".8"/>''')
svg('star-goggles','''<path d="M101 81Q150 73 203 81L206 119Q150 136 97 119Z" fill="#192a47" stroke="#cdacff" stroke-width="3"/><rect x="104" y="88" width="42" height="31" rx="11" fill="url(#lens)" stroke="#ab81ea" stroke-width="2"/><rect x="156" y="88" width="41" height="31" rx="11" fill="url(#lens)" stroke="#ab81ea" stroke-width="2"/><path d="M146 99H156M87 89l12 8m108 0 7-8" stroke="#eed7ff" stroke-width="5"/><path d="M111 93l17 5m34 0 23-5" stroke="#adf2ff" opacity=".8" stroke-width="3"/>''',accent='#bd8aff')

def beard(long=False):
    art='''<path d="M114 134Q123 151 144 150Q148 142 152 149Q174 150 188 134L190 157Q176 179 150 184Q126 177 112 157Z" fill="url(#hair)" stroke="#492c25" stroke-width="1.5"/>
    <path d="M119 137Q132 128 145 134L151 139L157 134Q175 129 183 137Q174 146 157 143L151 140L144 144Q129 148 119 137Z" fill="url(#hair)"/>
    <path d="M139 148Q150 153 163 148" stroke="#e5b480" stroke-width="2" fill="none"/>'''
    if long: art+='<path d="M115 155Q127 167 150 165Q175 166 187 155L182 184L166 202L151 214L134 202L119 184Z" fill="url(#hair)"/>'
    r=Random(5)
    for _ in range(44):
        x=r.randint(120,181);y=r.randint(153,174 if not long else 195)
        if long and abs(x-151)>(212-y)*.7:continue
        art+=f'<path d="M{x} {y}q-2 5 0 8" fill="none" stroke="#bc8150" opacity=".45" stroke-width=".8"/>'
    # Directional strands follow the jaw and gather toward the chin.
    for x in range(119,185,5):
        y=151+abs(x-151)*.15
        end=190 if long else 175
        art+=f'<path d="M{x} {y:.1f}Q{x+(151-x)*.15:.1f} {end-6} {x+(151-x)*.3:.1f} {end}" fill="none" stroke="#d1a16a" opacity=".28" stroke-width=".7"/>'
    return art
svg('short-beard',beard())
svg('explorer-beard',beard(True))
svg('frost-beard',beard(True).replace('#bc8150','#e6effa').replace('#d1a16a','#f7faff').replace('url(#hair)','url(#metal)'))

def blaster(gold=False):
    c='#ffd078' if gold else '#5deafa'
    return f'''<g transform="rotate(-12 232 258)" stroke="#14273f" stroke-width="2"><path d="M209 266L207 299L220 302L226 270Z" fill="url(#leather)"/><rect x="202" y="239" width="66" height="30" rx="7" fill="url(#metal)"/><path d="M222 239V231H244V238" fill="#243e53"/><rect x="253" y="242" width="21" height="24" rx="4" fill="#264860"/><path d="M275 244V264" stroke="{c}" stroke-width="5"/><path d="M212 248H240" stroke="{c}" stroke-width="4"/><path d="M228 274Q236 285 224 289" fill="none" stroke="#8fabc0" stroke-width="3"/><circle cx="249" cy="254" r="5.5" fill="#0b2438"/><circle cx="249" cy="254" r="3.5" fill="{c}"/><path d="M207 242h37m14 3h9" stroke="#edf6ff" stroke-width="1.2" opacity=".65"/><path d="M235 260v5m4-5v5m4-5v5" stroke="#183047" stroke-width="2"/><circle cx="206" cy="246" r="1.4" fill="#e0ebf1"/><circle cx="259" cy="260" r="1.4" fill="#e0ebf1"/><path d="M208 256h23m-21 20 8 2m-9 6 7 2m-8 6 6 2" stroke="#314f66" stroke-width="2"/></g>'''
svg('starter-blaster',blaster())
svg('solar-cannon',blaster(True).replace('width="66"','width="71"'),accent='#ffd078')
svg('pulse-blade','''<g transform="rotate(19 235 272)"><path d="M228 268L229 174L235 157L241 174L242 268Z" fill="url(#trim)" stroke="#e5d0ff" stroke-width="2"/><path d="M235 164V263" stroke="white" stroke-width="2" opacity=".8"/><rect x="216" y="267" width="37" height="8" rx="4" fill="url(#metal)"/><rect x="230" y="274" width="12" height="34" rx="4" fill="#283750" stroke="#9c7ed0" stroke-width="2"/><path d="M231 282l10 3m-10 3 10 3m-10 3 10 3" stroke="#b7a0de" stroke-width="2"/><circle cx="236" cy="310" r="6" fill="url(#metal)"/></g>''',accent='#bb8eff')
print('Generated original mascot and interchangeable accessories.')
