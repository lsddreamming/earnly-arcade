"""Original, deterministic mono sound design; no downloads or runtime synthesis."""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 22050
# duration, start Hz, end Hz, noise blend, overtone blend
CUES = {
    'zap': (.18, 1500, 230, .06, .25),
    'laser': (.40, 360, 80, .12, .60),
    'hit': (.13, 950, 180, .45, .20),
    'pop': (.38, 320, 65, .55, .15),
    'portal': (.65, 110, 720, .20, .35),
    'reload': (.32, 170, 520, .30, .40),
    'ready': (.26, 880, 1320, .0, .20),
    'switch': (.15, 420, 840, .08, .30),
    'wave': (.70, 330, 660, .0, .30),
    'win': (.95, 523, 1046, .0, .25),
    'lose': (.75, 330, 82, .06, .30),
    'runner': (.35, 650, 370, .08, .30),
    'armor': (.45, 220, 170, .12, .65),
    'brute': (.60, 95, 55, .18, .70),
    'flyer': (.42, 1100, 780, .03, .35),
    'hurt': (.24, 150, 65, .20, .30),
    'empty': (.09, 180, 110, .45, .10),
}

def samples(name):
    duration, low, high, noise, overtone = CUES[name]
    count = round(duration * RATE)
    rng = random.Random(name)
    phase = 0.0
    result = []
    for i in range(count):
        t, u = i / RATE, i / (count - 1)
        frequency = low * (high / low) ** u
        if name in ('runner', 'armor', 'brute', 'flyer'):
            frequency *= 1 + .10 * math.sin(2 * math.pi * 18 * t)
        if name in ('wave', 'win'):
            notes = (1, 1.25, 1.5, 2)
            frequency = low * notes[min(3, int(u * 4))]
        phase += 2 * math.pi * frequency / RATE
        tone = (math.sin(phase) + overtone * math.sin(phase * 2)) / (1 + overtone)
        # Gentle attack and zero-valued endpoints avoid clicks; leave mixing headroom.
        envelope = min(1, t / .012) * (1 - u) ** 1.5
        if name == 'reload':
            envelope *= .3 + .7 * math.sin(math.pi * 9 * t) ** 8
        value = .48 * envelope * ((1 - noise) * tone + noise * rng.uniform(-1, 1))
        result.append(round(32767 * value))
    return result

def write_sounds(directory, prefix=''):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    for name in CUES:
        with wave.open(str(directory / f'{prefix}{name}.wav'), 'wb') as audio:
            audio.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            data = samples(name)
            audio.writeframes(struct.pack(f'<{len(data)}h', *data))

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('directory')
    parser.add_argument('--prefix', default='')
    args = parser.parse_args()
    write_sounds(args.directory, args.prefix)
