"""Shared face finishing for generated SVGs; preserve equipment coordinates."""
import re

BODIES = {'cyber-starter', 'neon-phantom', 'vortex-mech', 'astra-prime', 'russet-potato', 'cream-potato', 'rose-potato'}

def finish_face(name, art):
    if 'data-face-finish' in art:
        return art
    detail = ''
    if name in BODIES or (name.startswith('eyes-') and name != 'eyes-happy'):
        # Local gradients keep each selected iris color, with a luminous lower edge.
        def iris(m):
            x, y, color = m.groups()
            ident = 'iris-finish-' + x
            tone = '#348ca9' if color.startswith('url(') else color
            return (f'<defs><radialGradient id="{ident}" cx=".45" cy=".7" r=".75">'
                    f'<stop stop-color="#b7f6f0"/><stop offset=".48" stop-color="{tone}"/>'
                    '<stop offset="1" stop-color="#16243b"/></radialGradient></defs>'
                    f'<ellipse cx="{x}" cy="{y}" rx="10" ry="14" fill="url(#{ident})"/>')
        art = re.sub(r'<ellipse cx="(\d+)" cy="(104)" rx="10" ry="14" fill="([^"]+)"/>', iris, art)
        for x in (125,176):
            detail += (f'<path d="M{x-15} 93Q{x} 76 {x+15} 93" fill="none" stroke="#49343b" stroke-width="2.2" stroke-linecap="round"/>'
                       f'<path d="M{x-10} 122Q{x} 127 {x+10} 122" fill="none" stroke="#fff0c9" stroke-width="1.6" opacity=".55" stroke-linecap="round"/>')
    if name in BODIES or name in {'mouth-smile','mouth-grin'}:
        detail += '<path d="M144 154Q153 150 162 153Q154 158 146 156Z" fill="#d88789" opacity=".8"/><path d="M128 137l-3 3m49-5 3 3" stroke="#79504b" stroke-width="1.8" stroke-linecap="round"/><path d="M140 164Q151 168 163 163" fill="none" stroke="#ffe3bb" stroke-width="1.5" opacity=".5" stroke-linecap="round"/>'
    if name in BODIES or name in {'nose-classic','nose-round','nose-freckle'}:
        detail += '<path d="M147 120q3-4 6-1" fill="none" stroke="#fff0cc" stroke-width="2.3" opacity=".65" stroke-linecap="round"/><path d="M146 132q6 3 12-1" fill="none" stroke="#69463e" stroke-width="1.4" opacity=".35" stroke-linecap="round"/>'
    return art + ('<g data-face-finish="1">'+detail+'</g>' if detail else '')
