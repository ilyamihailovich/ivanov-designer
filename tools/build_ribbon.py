#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает горизонтальную ленту кейса из выгруженного борда Figma.

    python3 tools/build_ribbon.py <борд.png> <ширина> <высота> <слаг> "<Заголовок>"

Делает три вещи:
  * режет борд на плитки по 700 px макета и кладёт их в cases/<слаг>-ribbon/;
  * пишет <слаг>-case.html — ленту в натуральную величину макета, которую окно
    кейса само измеряет и масштабирует по своей высоте;
  * считает остановки для листания: координаты колонок, где по вертикали нет
    содержимого. Шаг листания заканчивается в такой колонке, поэтому текст не
    обрезается ни справа, ни слева.
"""
import os, sys, math, json
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
TILE = 700


def tiles(src, outdir, bw, bh):
    im = Image.open(src).convert('RGB')
    s = im.width / bw
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith('.jpg') and f[0].isdigit():
            os.remove(os.path.join(outdir, f))
    n = math.ceil(bw / TILE)
    parts = []
    for i in range(n):
        x0, x1 = i * TILE, min(bw, (i + 1) * TILE)
        im.crop((round(x0 * s), 0, round(x1 * s), im.height)).save(
            os.path.join(outdir, '%02d.jpg' % (i + 1)),
            quality=86, optimize=True, progressive=True)
        parts.append(('%02d.jpg' % (i + 1), x1 - x0))
    assert sum(w for _, w in parts) == bw, 'плитки не сходятся в ширину борда'
    return parts


def gutters(src, bw, pct, mingap, minrun):
    """Колонки, в которых яркость по вертикали почти не меняется, — там пусто."""
    g = Image.open(src).convert('L')
    a = np.asarray(g.resize((bw, 240), Image.BILINEAR), dtype=np.float32)
    std = a.std(axis=0)
    empty = std < max(1.5, float(np.percentile(std, pct)) + 1.0)
    runs, i = [], 0
    while i < bw:
        if empty[i]:
            j = i
            while j < bw and empty[j]:
                j += 1
            if j - i >= minrun:
                runs.append((i, j))
            i = j
        else:
            i += 1
    pts = sorted({0} | {int((x + y) // 2) for x, y in runs} | {bw})
    out = [pts[0]]
    for p in pts[1:]:
        if p - out[-1] >= mingap:
            out.append(p)
    if out[-1] != bw:
        out.append(bw)
    return out


def stops(src, bw):
    # чистые промежутки плюс более чуткий второй уровень — чтобы шаг всегда
    # находил куда встать даже там, где блоки идут сплошняком
    allp = sorted(set(gutters(src, bw, 8, 90, 12)) | set(gutters(src, bw, 30, 60, 5)))
    out = [allp[0]]
    for p in allp[1:]:
        if p - out[-1] >= 60:
            out.append(p)
    if out[-1] != bw:
        out.append(bw)
    return out


def main():
    src, bw, bh, slug, title = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
    outdir = 'cases/%s-ribbon' % slug
    parts = tiles(src, outdir, bw, bh)
    st = stops(src, bw)
    imgs = '\n'.join(
        '  <img src="%s/%s" width="%d" height="%d" alt="" %s>' %
        (outdir, fn, w, bh, 'fetchpriority="high"' if i < 2 else 'loading="lazy"')
        for i, (fn, w) in enumerate(parts))
    open('%s-case.html' % slug, 'w', encoding='utf-8').write("""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s</title>
<style>
  /* Лента в натуральную величину макета (%d x %d). Окно кейса измеряет её и
     масштабирует по своей высоте — так же, как у Санька. */
  html,body{margin:0;padding:0;background:#fff;overflow:hidden;}
  .lane{position:relative;width:%dpx;height:%dpx;font-size:0;white-space:nowrap;}
  .lane img{display:inline-block;height:%dpx;vertical-align:top;border:0;}
</style>
</head>
<body>
<div class="lane" data-stops="%s">
%s
</div>
</body>
</html>
""" % (title, bw, bh, bw, bh, bh, ','.join(map(str, st)), imgs))
    size = sum(os.path.getsize(os.path.join(outdir, fn)) for fn, _ in parts)
    d = np.diff(st)
    print('%s-case.html: %d плиток, %.1f МБ, лента %dx%d, остановок %d (шаг мед %d, макс %d)'
          % (slug, len(parts), size / 1e6, bw, bh, len(st), int(np.median(d)), int(d.max())))


if __name__ == '__main__':
    main()
