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
    <linearGradient id="metal" x2=".75" y2="1"><stop stop-color="#dce6e9"/><stop offset=".3" stop-color="#7e98ac"/><stop offset=".48" stop-color="#e1e9eb"/><stop offset=".55" stop-color="#496477"/><stop offset="1" stop-color="#192c40"/></linearGradient>
    <linearGradient id="trim" x2="1" y2="1"><stop stop-color="#edfcff"/><stop offset=".4" stop-color="{accent}"/><stop offset="1" stop-color="#287c9f"/></linearGradient>
    <linearGradient id="leather" x2=".8" y2="1"><stop stop-color="#c59269"/><stop offset=".5" stop-color="#855339"/><stop offset="1" stop-color="#392722"/></linearGradient>
    <linearGradient id="hair" x2=".3" y2="1"><stop stop-color="#8f5a36"/><stop offset=".6" stop-color="#492b25"/><stop offset="1" stop-color="#241b22"/></linearGradient>
    <radialGradient id="lens" cx=".3" cy=".15"><stop stop-color="#84d9ef"/><stop offset=".6" stop-color="#153e64"/><stop offset="1" stop-color="#09182b"/></radialGradient>
    </defs>'''
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
    art=f'''<g stroke="#13273b" stroke-width="2" stroke-linejoin="round">
    <path d="M100 184L77 199L64 249L89 257L106 215M198 184L220 199L232 248L208 257L193 215" fill="url(#cloth)"/>
    <path d="M103 177Q151 191 198 177L206 230L205 290Q151 310 96 289L95 229Z" fill="url(#cloth)"/>
    <path d="M110 284L102 343L137 346L150 299L166 346L199 343L189 284Z" fill="url(#cloth)"/>
    </g>
    <path d="M109 185L138 199L150 189L163 199L191 186" fill="none" stroke="{color}" stroke-width="3"/>
    <path d="M150 203V288" stroke="#91abb6" stroke-width="2"/><path d="M153 210V275" stroke="#101c2b" stroke-width="2"/>
    <path d="M108 254L133 256L130 279L110 275ZM167 256L191 254L190 275L169 279Z" fill="#182c40" stroke="#587286" stroke-width="1.5"/>
    <path d="M104 237Q110 203 123 199M198 238Q190 205 178 199M119 307L112 335M183 305L190 335" fill="none" stroke="#7591a3" opacity=".5"/>
    <path d="M98 283Q152 298 203 283M70 242L92 250M209 250L228 241" fill="none" stroke="{color}" stroke-width="3"/>
    <rect x="148" y="214" width="5" height="9" rx="2" fill="#d6e6ea"/>
    <path d="M112 216L128 218L126 237L116 238Z" fill="{color}" opacity=".75"/><path d="M116 221l7 1m-6 4 5 1" stroke="white" opacity=".7"/>
    <path d="M112 293L105 337M192 291L197 337" fill="none" stroke="#a5baca" stroke-dasharray="2 3" opacity=".4"/>'''
    if hoodie:
        art+=f'<path d="M102 180Q97 163 114 165Q146 185 186 163Q207 162 199 181L169 205L151 194L134 206Z" fill="{color}" stroke="#384858" stroke-width="2"/><path d="M132 195v29m37-29v29" stroke="#ffe4b7" stroke-width="2"/><path d="M122 252Q151 242 178 252L180 277Q150 287 120 276Z" fill="#435c6c" stroke="#99a9b1" stroke-width="1.5"/>'
    if armored:
        art+='<path d="M103 185L130 200L151 190L173 200L196 185L201 242L180 260L122 260L99 244Z" fill="url(#metal)" stroke="#425e75" stroke-width="2"/><path d="M118 213L151 227L184 213L177 243L151 252L125 243Z" fill="#142c42" stroke="#ffc865" stroke-width="3"/><path d="M151 229L159 237L151 245L143 237Z" fill="#ffe292"/><path d="M80 196L100 188L106 209L75 217ZM200 188L220 196L226 217L195 209Z" fill="url(#metal)" stroke="#ffe49a" stroke-width="2"/>'
    return art

svg('starter-suit',jacket())
svg('neon-jacket',jacket('#b899ff',True),accent='#b899ff')
svg('astral-armor',jacket('#ffd271',armored=True),accent='#ffd271')
svg('cozy-hoodie',jacket('#c49778',True))

def shoes(kind='boots',accent='#7ae4eb'):
    fill='url(#leather)' if kind=='boots' else 'url(#cloth)'
    return f'''<g stroke="#1a2535" stroke-width="2"><path d="M108 336L135 339L137 359Q147 370 132 375H93Q88 368 94 358L104 355Z" fill="{fill}"/>
    <path d="M166 339L193 336L197 355L209 359Q215 369 209 375H170Q156 371 164 359Z" fill="{fill}"/></g>
    <path d="M91 368H140M163 368H212" stroke="#e1d9c6" stroke-width="6" stroke-linecap="round"/>
    <path d="M108 346L129 349M106 352L128 355M173 349L191 346M172 355L192 352" stroke="{accent}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M98 359Q116 361 134 359M171 359Q189 361 205 359" fill="none" stroke="#fff" opacity=".25"/>
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
    return art
svg('short-beard',beard())
svg('explorer-beard',beard(True))
svg('frost-beard',beard(True).replace('#bc8150','#e6effa').replace('url(#hair)','url(#metal)'))

def blaster(gold=False):
    c='#ffd078' if gold else '#5deafa'
    return f'''<g transform="rotate(-12 232 258)" stroke="#14273f" stroke-width="2"><path d="M209 266L207 299L220 302L226 270Z" fill="url(#leather)"/><rect x="202" y="239" width="66" height="30" rx="7" fill="url(#metal)"/><path d="M222 239V231H244V238" fill="#243e53"/><rect x="253" y="242" width="21" height="24" rx="4" fill="#264860"/><path d="M275 244V264" stroke="{c}" stroke-width="5"/><path d="M212 248H240" stroke="{c}" stroke-width="4"/><path d="M228 274Q236 285 224 289" fill="none" stroke="#8fabc0" stroke-width="3"/><circle cx="249" cy="254" r="4" fill="{c}"/><path d="M208 256h23m-21 20 8 2m-9 6 7 2m-8 6 6 2" stroke="#314f66" stroke-width="2"/></g>'''
svg('starter-blaster',blaster())
svg('solar-cannon',blaster(True).replace('width="66"','width="71"'),accent='#ffd078')
svg('pulse-blade','''<g transform="rotate(19 235 272)"><path d="M228 268L229 174L235 157L241 174L242 268Z" fill="url(#trim)" stroke="#e5d0ff" stroke-width="2"/><path d="M235 164V263" stroke="white" stroke-width="2" opacity=".8"/><rect x="216" y="267" width="37" height="8" rx="4" fill="url(#metal)"/><rect x="230" y="274" width="12" height="34" rx="4" fill="#283750" stroke="#9c7ed0" stroke-width="2"/><path d="M231 282l10 3m-10 3 10 3m-10 3 10 3" stroke="#b7a0de" stroke-width="2"/><circle cx="236" cy="310" r="6" fill="url(#metal)"/></g>''',accent='#bb8eff')
print('Generated original mascot and interchangeable accessories.')
