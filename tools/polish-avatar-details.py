"""Finish the existing 300x400 Spud SVG rig; preserve catalog IDs and face anchors.

Run after any legacy art generator. Only the named assets are changed and each
result is mirrored into the native web bundle. No raster filters or animation.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
written = []


def save(name, art, defs=''):
    content = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">\n'
               f'<defs>{defs}</defs>\n{art}\n</svg>\n')
    write(name, content)


def write(name, content):
    for folder in (ROOT, ROOT / 'www'):
        (folder / f'cosmetic-{name}.svg').write_text(content)
    written.append(name)


def gradient(name, colors, radial=False):
    tag = 'radialGradient' if radial else 'linearGradient'
    axis = 'cx=".32" cy=".22" r=".9"' if radial else 'x1=".15" y1="0" x2=".8" y2="1"'
    stops = ''.join(f'<stop offset="{i/(len(colors)-1):.2f}" stop-color="{c}"/>' for i, c in enumerate(colors))
    return f'<{tag} id="{name}" {axis}>{stops}</{tag}>'


def path(d, fill='none', stroke=None, width=1.5, extra=''):
    line = f' stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"' if stroke else ''
    return f'<path d="{d}" fill="{fill}"{line}{extra}/>'


# Long waves have curved tips and separate locks, rather than a flat angular cap.
waves = ('M89 88C70 58 82 34 109 26C139 15 172 19 195 34C216 47 223 63 215 88'
         'C210 109 231 130 218 148L211 159C202 150 199 140 202 126C205 108 199 90 204 78'
         'C182 75 163 62 151 47C137 65 118 78 96 88C103 107 92 120 99 138'
         'C103 148 95 157 87 163C89 146 74 142 79 126C86 110 83 98 89 88Z')
sweep = 'M85 81Q72 37 118 25Q174 8 206 46L213 81Q175 66 161 46Q130 85 85 81Z'
for name, shape, colors, outline in [
    ('hair-waves', waves, ['#ecb0b9', '#a65a76', '#51324c'], '#573349'),
    ('hair-aurora', waves, ['#c3b6ff', '#6e65be', '#303b76'], '#454474'),
    ('boardwalk-hair', sweep, ['#cda6ed', '#8054ac', '#402b6c'], '#473458'),
]:
    defs = gradient('locks', colors) + f'<clipPath id="locks-clip">{path(shape)}</clipPath>'
    art = path(shape, 'url(#locks)', outline, 2.2)
    lines = ('M92 65Q107 34 144 32M101 69Q123 48 146 39M166 30Q188 39 203 60'
             'M174 54Q188 68 205 73')
    shadows = 'M105 77Q133 66 151 45M162 45Q184 67 208 73'
    if name != 'boardwalk-hair':
        lines += 'M88 94C95 112 82 122 88 138M91 116C82 141 95 143 91 153M211 91C204 113 222 128 213 143'
        shadows += 'M96 89C105 110 92 122 100 143M204 81C195 105 214 127 205 144'
    art += '<g clip-path="url(#locks-clip)">' + path(shadows, stroke=colors[-1], width=3, extra=' opacity=".5"')
    art += path(lines, stroke=colors[0], width=3.2, extra=' opacity=".55"')
    art += path(lines, stroke='#fff3f6', width=.8, extra=' opacity=".4"')
    if name == 'hair-aurora':
        defs += gradient('aurora-ribbon', ['#c4b9ff', '#8ee8e2', '#4775bf'])
        art += path('M86 72Q102 35 140 33M87 98C94 118 80 127 88 146M211 98C205 117 220 128 213 146', stroke='url(#aurora-ribbon)', width=4)
    if name == 'boardwalk-hair':
        art += path('M92 62Q112 36 141 32', stroke='#a4e6ed', width=2, extra=' opacity=".65"')
    save(name, art + '</g>', defs)

# Beard volume follows the jaw. Keep the mouth opening and use directional locks.
short = ('M114 135C122 145 128 151 140 153Q151 157 163 152C175 151 182 142 188 135'
         'L189 153C187 165 178 173 168 176L163 180L153 182L145 180L138 181'
         'L130 176C118 172 111 163 112 153Z')
long = ('M114 135C123 147 130 152 141 153Q152 158 163 152C176 150 182 141 188 135'
        'C190 153 187 168 182 184L177 190L174 198L166 200L162 207L154 210L150 214'
        'L143 208L135 206L132 199L124 194L121 184C115 169 110 151 114 135Z')
mustache = ('M117 138C125 130 138 130 149 138C156 130 175 130 185 138'
            'C177 145 166 146 156 141L151 139L145 143C134 146 123 144 117 138Z')
for name in ['short-beard', 'explorer-beard', 'frost-beard', 'braided-beard']:
    frost = name == 'frost-beard'
    colors = ['#f1f5f7', '#a6bdca', '#607c91'] if frost else ['#ad794e', '#67422e', '#352a29']
    shape = short if name == 'short-beard' else long
    defs = gradient('beard-volume', colors, True) + f'<clipPath id="beard-clip">{path(shape)}</clipPath>'
    art = path(shape, 'url(#beard-volume)', colors[-1], 1.2)
    art += '<g clip-path="url(#beard-clip)">'
    # Deliberate curved groups follow the jaw, instead of randomly scattered lines.
    for x in range(117, 188, 7):
        end = (180 if name == 'short-beard' else 210) - abs(151-x)*.48
        inward = (151-x)*.38
        art += path(f'M{x} 151Q{x-2} 166 {x+inward:.1f} {end:.1f}', stroke=colors[-1], width=2, extra=' opacity=".35"')
        art += path(f'M{x+2} 154Q{x} 167 {x+inward+2:.1f} {end-5:.1f}', stroke=colors[0], width=1, extra=' opacity=".3"')
    art += '</g>' + path(mustache, 'url(#beard-volume)', colors[-1], 1)
    art += path('M123 137Q135 132 146 138M156 137Q168 132 179 137', stroke=colors[0], width=1.4, extra=' opacity=".65"')
    if name == 'braided-beard':
        art += path('M138 169Q132 182 143 190Q136 200 151 213Q166 200 159 190Q170 178 160 169Z', 'url(#beard-volume)', '#382b2a', 1.3)
        for y, width in [(171, 12), (181, 11), (191, 9)]:
            art += path(f'M{151-width} {y}Q151 {y+1} {151+width} {y+10}Q151 {y+12} {151-width+3} {y+17}', 'url(#beard-volume)', '#c79b64', 1.2)
        defs += gradient('braid-clasp', ['#ffebae', '#c69a4c', '#735531'])
        art += '<rect x="145" y="204" width="12" height="7" rx="2" fill="url(#braid-clasp)" stroke="#543e2f"/>'
    save(name, art, defs)

# Mouths share the same center, with softer lip edges and tooth/tongue shading.
mouth_defs = (gradient('mouth-depth', ['#352738', '#653443'], True)
              + gradient('lip', ['#eeb1b5', '#b85c79', '#793a59'])
              + gradient('teeth', ['#fffdf2', '#ecdbbd'])
              + gradient('tongue', ['#eea2ab', '#ba687f']))
mouths = {
    'mouth-smile': path('M129 139Q150 154 174 137Q162 163 143 156Z', 'url(#mouth-depth)') + path('M134 141Q151 149 168 140L165 145Q151 151 137 146Z', 'url(#teeth)') + path('M144 154Q153 150 162 153Q154 158 146 156Z', 'url(#tongue)'),
    'mouth-grin': path('M126 138Q150 144 178 136Q169 164 149 161Q134 159 126 138Z', 'url(#mouth-depth)') + path('M129 140Q151 146 175 139L170 149Q150 155 134 148Z', 'url(#teeth)') + path('M141 157Q153 151 165 155Q153 163 141 157Z', 'url(#tongue)'),
    'mouth-rose': path('M131 142Q141 136 151 141Q160 134 173 140Q158 158 144 153Z', 'url(#lip)', '#954b62', .7) + path('M136 143Q151 148 168 142', stroke='#683944', width=1.6) + path('M144 150Q151 153 158 150', stroke='#f9cbd1', width=1.5, extra=' opacity=".7"'),
    'mouth-wow': '<ellipse cx="151" cy="146" rx="8" ry="11" fill="url(#mouth-depth)" stroke="#a56c65" stroke-width="1"/>' + '<ellipse cx="152" cy="152" rx="5" ry="3" fill="url(#tongue)"/>' + path('M147 137Q151 135 154 137', stroke='#f1c7a9', width=1.3),
    'mouth-smirk': path('M134 147Q155 150 172 138M171 135l4 6', stroke='#74433f', width=2.6) + path('M142 152Q155 155 165 147', stroke='#f5c9aa', width=1.8, extra=' opacity=".6"'),
    'mouth-soft': path('M134 143Q152 155 170 141', stroke='#74433f', width=3) + path('M141 151Q152 157 164 149', stroke='#f5c9aa', width=1.8, extra=' opacity=".6"'),
    'mouth-vampire': path('M129 139Q150 151 174 137Q162 163 143 156Z', 'url(#mouth-depth)') + path('M144 154Q153 150 162 153Q154 158 146 156Z', 'url(#tongue)') + path('M136 143Q141 144 147 145L142 156ZM157 144Q162 143 168 141L162 155Z', 'url(#teeth)', '#ddcbb6', .6),
}
for name, art in mouths.items():
    if name in ['mouth-smile', 'mouth-grin', 'mouth-vampire']:
        art += path('M128 137l-3 3m49-5 3 3', stroke='#89554b', width=1.5)
        art += path('M140 164Q151 168 163 163', stroke='#ffe3bb', width=1.3, extra=' opacity=".45"')
    save(name, art, mouth_defs)

# A soft blush and small enamel/gold details read clearly at portrait size.
blush = '<radialGradient id="blush"><stop stop-color="#db7593" stop-opacity=".6"/><stop offset="1" stop-color="#e88b99" stop-opacity="0"/></radialGradient>'
save('marks-blush', '<ellipse cx="107" cy="127" rx="16" ry="10" fill="url(#blush)"/><ellipse cx="196" cy="127" rx="16" ry="10" fill="url(#blush)"/>', blush)
save('marks-heart', path('M194 132L184 123Q182 114 189 114Q194 114 194 119Q195 113 201 114Q209 117 203 124Z', 'url(#enamel)', '#fbd9e8', .8) + path('M186 120Q186 115 190 117', stroke='#fff0f4', width=1.6) + path('M196 127l4-4', stroke='#a74979', width=1, extra=' opacity=".6"'), gradient('enamel', ['#ffd4e0', '#e47fa9', '#b74f86']))
freckles = ''
for x, y, r in [(103,119,1.6),(110,115,1.2),(116,122,1.8),(105,126,1.1),(113,129,.9),(190,120,1.4),(197,115,1.7),(203,123,1.2),(196,128,1.6),(187,126,.8)]:
    freckles += f'<circle cx="{x}" cy="{y}" r="{r}" fill="#80523d" opacity=".62"/>'
save('marks-freckles', freckles)
stars = ''
for x, y, s in [(106,122,1),(196,122,1),(115,128,.35),(187,127,.4),(99,115,.3),(203,114,.35)]:
    stars += f'<g transform="translate({x} {y}) scale({s})">' + path('M0-8L2-2L8 0L2 2L0 8L-2 2L-8 0L-2-2Z', 'url(#starlight)', '#fff1cc', .7) + '</g>'
save('marks-starlight', stars, gradient('starlight', ['#fff8d6', '#e9bf68', '#b78943']))

# Skin-matched nose variants keep the rig's existing filenames and color palette.
palettes = [('', '#e5ba87', '#a06c48'), ('cyber-starter','#ffe0a0','#b48150'), ('neon-phantom','#d4b5ff','#7562ad'), ('vortex-mech','#bdd4db','#667f97'), ('astra-prime','#ffe6a3','#c79749'), ('russet-potato','#dfb37c','#805035'), ('cream-potato','#fff0c5','#c9a16b'), ('rose-potato','#edc1a9','#a56c62')]
for skin, light, shade in palettes:
    defs = gradient('nose-skin', [light, shade], True)
    for kind in ['classic', 'round', 'tiny', 'freckle']:
        if kind == 'round':
            art = '<ellipse cx="151" cy="124" rx="10" ry="8" fill="url(#nose-skin)"/>'
            art += path('M143 126Q151 134 159 126', stroke=shade, width=1.1)
            art += path('M146 120Q149 117 153 119', stroke=light, width=2)
        elif kind == 'tiny':
            art = path('M148 119Q143 127 151 128Q158 128 155 123', 'url(#nose-skin)')
            art += path('M147 125Q151 129 155 125', stroke=shade, width=1.4)
        else:
            art = path('M148 111C146 117 141 121 144 126Q148 132 155 129Q161 127 157 121', 'url(#nose-skin)')
            art += path('M145 127Q151 132 157 127', stroke=shade, width=1.1)
            art += path('M147 120Q148 117 150 116', stroke=light, width=1.8)
            if kind == 'freckle':
                art += f'<g fill="{shade}"><circle cx="148" cy="122" r="1"/><circle cx="154" cy="124" r="1.2"/><circle cx="151" cy="119" r=".8"/></g>'
        art += path('M147 133Q152 135 157 132', stroke=shade, width=1, extra=' opacity=".25"')
        save('nose-' + kind + ('-' + skin if skin else ''), art, defs)

# Premium skins get subtle identity marks in both their legacy and layered forms.
# Leave the face anchors, silhouettes and existing armor untouched.
skin_details = {
    'neon-phantom': path('M92 95L96 109L91 123M208 95L204 109L209 123', stroke='#d4c5ff', width=1.5, extra=' opacity=".7"') + path('M94 136l3 4m109-4-3 4', stroke='#a9eff5', width=2),
    'vortex-mech': path('M92 89L96 103L92 119L99 131M210 89L206 103L210 119L203 131', stroke='#59758e', width=1.4) + '<circle cx="95" cy="106" r="2.5" fill="#a8eaff"/><circle cx="207" cy="106" r="2.5" fill="#a8eaff"/>' + path('M122 164Q151 177 180 164', stroke='#e1f3f4', width=1.8, extra=' opacity=".65"'),
    'astra-prime': path('M93 97Q89 116 98 133M209 97Q213 116 204 133', stroke='#fff1bd', width=2) + path('M103 136l2 4 4 1-4 1-2 4-1-4-4-1 4-1ZM200 134l2 4 4 1-4 1-2 4-1-4-4-1 4-1Z', '#fff1bf') + '<circle cx="111" cy="143" r="1.2" fill="#fff6d1"/><circle cx="192" cy="143" r="1.2" fill="#fff6d1"/>',
}
for name, details in skin_details.items():
    for suffix in ['', '-body']:
        file = ROOT / f'cosmetic-{name}{suffix}.svg'
        content = re.sub(r'<g id="skin-signature">.*?</g>', '', file.read_text(), flags=re.S)
        content = content.replace('</svg>', f'<g id="skin-signature">{details}</g></svg>')
        write(name + suffix, content)

print(f'Finished {len(written)} SVG assets, with matching native copies.')
