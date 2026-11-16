#!/usr/bin/env python3
"""Deterministic, original, mono sci-fi cues; no runtime synthesis or network."""
import math, struct, wave, sys
from pathlib import Path
RATE = 22050
CUES = {'zap':(.20,900,350), 'plasma':(.16,740,160), 'zapper':(.32,1600,90),
        'charge':(1.1,65,240), 'breach':(.42,130,45), 'wave':(.65,180,460), 'reload':(.35,320,680)}
def generate(destination, prefix=''):
    destination = Path(destination); destination.mkdir(parents=True, exist_ok=True)
    for name, (duration,start,end) in CUES.items():
        frames = bytearray(); total = int(duration*RATE)
        for i in range(total):
            t=i/RATE; progress=i/total
            phase=2*math.pi*(start*t+(end-start)*t*t/(2*duration))
            envelope=min(1,t/.012)*(1-progress)**(0.7 if name=='charge' else 1.8)
            carrier=math.sin(phase)+.25*math.sin(phase*2.01)+.12*math.sin(phase*3.03)
            if name in ('zapper','breach'): carrier *= .65+.35*math.sin(2*math.pi*37*t)
            if name=='wave': carrier += .3*math.sin(phase*1.5)
            frames.extend(struct.pack('<h',int(6000*envelope*carrier)))
        with wave.open(str(destination/(prefix+name+'.wav')),'wb') as audio:
            audio.setparams((1,2,RATE,0,'NONE','not compressed')); audio.writeframes(frames)
if __name__ == '__main__': generate(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else '')
