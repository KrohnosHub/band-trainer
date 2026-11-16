#!/usr/bin/env python3
"""Erzeugt die App-Icons (Keyboard-Tasten) als PNG. Aufruf: python3 tools/make-icons.py  (braucht Pillow)"""
import os
from PIL import Image, ImageDraw
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
BG, WHITE, BLACK, ACCENT = (18, 20, 22), (235, 232, 226), (27, 30, 34), (227, 166, 60)

def icon(size, maskable=False):
    S = size * 4                                   # 4-fach gerendert, danach verkleinert (glatte Kanten)
    img = Image.new('RGB', (S, S), BG)
    d = ImageDraw.Draw(img)
    pad = S * (0.22 if maskable else 0.14)         # maskable: Motiv in der sicheren Zone (innere 80 %)
    x0, x1 = pad, S - pad
    y0, y1 = S * 0.5 - (x1 - x0) * 0.36, S * 0.5 + (x1 - x0) * 0.36
    n = 5; gap = S * 0.012; w = (x1 - x0 - gap * (n - 1)) / n; r = S * 0.03
    for i in range(n):                             # weisse Tasten, die mittlere als Akzent
        kx = x0 + i * (w + gap)
        d.rounded_rectangle([kx, y0, kx + w, y1], radius=r, fill=ACCENT if i == 2 else WHITE)
    bw, bh = w * 0.58, (y1 - y0) * 0.6
    for i in (0, 1, 3):                            # schwarze Tasten (Muster C#–D#, F#)
        cx = x0 + (i + 1) * (w + gap) - gap / 2
        d.rounded_rectangle([cx - bw / 2, y0 - r, cx + bw / 2, y0 + bh], radius=r * 0.7, fill=BLACK, outline=BG, width=int(S * 0.008))
    d.rectangle([x0, y0 - r * 2, x1, y0], fill=BG) # obere Kante gerade abschliessen
    return img.resize((size, size), Image.LANCZOS)

os.makedirs('icons', exist_ok=True)
icon(192).save('icons/icon-192.png', optimize=True)
icon(512).save('icons/icon-512.png', optimize=True)
icon(512, maskable=True).save('icons/icon-maskable-512.png', optimize=True)
print('Icons geschrieben')
