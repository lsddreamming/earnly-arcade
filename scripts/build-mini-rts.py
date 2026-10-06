"""Build the offline, single-file Crystal Command RTS from its shared game code.
Usage: python3 scripts/build-mini-rts.py /absolute/path/Crystal_Command_Mini_RTS.html
"""
from pathlib import Path
import re
import sys
ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'crystal-command.html').read_text()
html = re.sub(r'<link[^>]+>', '', html)
html = re.sub(r'<footer class="public-footer".*?</footer>', '', html, flags=re.S)
html = re.sub(r'<script src="[^"]+"></script>', '', html)
html = html.replace('Crystal Command · Strategy Battles | Earnly Arcade', 'Crystal Command · Offline Mini RTS')
html = html.replace('href="games.html"', 'href="#"').replace('← Games', '↻ Battle menu')
html = html.replace('EARNLY STRATEGY · SECTOR 01', 'OFFLINE RTS · SECTOR 01').replace('1v1 BATTLES', 'VS AI OPPONENT')
html = html.replace('<a class="cc-footer-link" href="privacy.html">Privacy</a>', '')
html = html.replace('Beta battles are free and do not award Coins or ranked results.', 'Offline practice · no sign-in or connection required.')
html = html.replace('<div id="context"', '<p class="demo-controls"><b>COMMAND GUIDE</b><br>Drag a yellow box to select troops.<br>Right-click to move and fight.<br>Right-drag to explore the map.<br>Tap the radar to send selected troops.<br>Workers mine automatically. Build a factory to train Soldiers; add a Tech core for Heavy Mechs.</p><div id="context"')
css = (ROOT / 'crystal-command.css').read_text() + '''
.room-actions,#authLink,#joinForm,#roomPane{display:none!important}
.demo-controls{font-size:11px;line-height:1.8;color:#9dbacf;margin:18px 0}.demo-controls b{color:#7fe5f6;font-size:10px;letter-spacing:2px}
@media(min-width:800px){
.cc-shell{max-width:none;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 330px;grid-template-rows:56px auto minmax(0,1fr) auto;gap:0}
.cc-top{grid-column:1/3;grid-row:1}.cc-hud{grid-column:2;grid-row:2;display:grid;grid-template-columns:1fr 1fr;padding:20px;gap:18px;border-left:1px solid #31536a}.cc-hud b{display:block;margin:4px 0;font-size:24px}.cc-hud span{font-size:10px}
.cc-field{grid-column:1;grid-row:2/5;min-height:0}.cc-dock{grid-column:2;grid-row:3;padding:18px;overflow:auto;min-height:0;border-left:1px solid #31536a;box-shadow:none}.cc-session{grid-column:2;grid-row:4;padding:12px 18px;border-left:1px solid #31536a}
.cc-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.cc-tools button{font-size:11px}.cc-palette,.cc-palette[data-mode=train],.cc-palette[data-mode=build],.cc-palette[data-mode=build]:has([data-kind=starport]){display:grid;grid-template-columns:1fr 1fr;grid-auto-flow:row;overflow:visible;justify-content:stretch}.cc-palette button,.cc-palette[data-mode=train] button{min-height:88px;padding:10px;font-size:12px}.cc-palette .cc-unit-symbol,.cc-palette[data-mode=train] .cc-unit-symbol{position:static;display:block}.cc-palette .cc-unit-symbol svg{width:25px;height:25px}.cc-role,.cc-palette[data-mode=build] .cc-role{font-size:10px}.cc-palette small{font-size:11px}.cc-context{text-align:left;font-size:11px}.cc-selection{margin-top:18px;gap:9px;flex-wrap:wrap}.cc-lesson{grid-column:1;grid-row:2}.cc-learning .cc-field{grid-row:3/5}.cc-menu .cc-field{grid-column:1/3;grid-row:2/5}.cc-menu .cc-hud,.cc-menu .cc-dock,.cc-menu .cc-session{display:none}.cc-card{max-width:410px}.cc-top h1{font-size:20px}
}
@media(max-width:799px){.demo-controls{display:none}}
'''
html = html.replace('</head>', '<style>'+css+'</style></head>')
# File URLs can forbid persistent storage; preferences still work in memory.
client = (ROOT / 'crystal-command.js').read_text().replace("const E=CrystalCommand,", "const safeStorage={getItem(k){try{return localStorage.getItem(k)}catch{return this[k]??null}},setItem(k,v){try{localStorage.setItem(k,v)}catch{this[k]=v}}};\nconst E=CrystalCommand,")
client = client.replace('localStorage.', 'safeStorage.')
client = client.replace('try{return safeStorage.getItem(k)}', 'try{return localStorage.getItem(k)}').replace('try{safeStorage.setItem(k,v)}', 'try{localStorage.setItem(k,v)}')
# The standalone vocabulary matches the requested core unit types.
code = '\n'.join((ROOT / f).read_text() for f in ['crystal-command-engine.js','crystal-command-art.js','crystal-command-renderer.js']) + '\n' + client
for old,new in [('Miners','Workers'),('Miner','Worker'),('Strikers','Soldiers'),('Striker','Soldier'),('Siege bot','Heavy Mech'),('siege bots','Heavy Mechs')]:
    html = html.replace(old,new)
    code = code.replace(old,new)
html = html.replace('</body>', '<script>'+code.replace('</script', '<\\/script')+'</script></body>')
out = Path(sys.argv[1])
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(html)
print(f'Built {out} ({out.stat().st_size:,} bytes)')
