#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает горизонтальную ленту кейса.

Два режима:

    board  — из выгруженного борда Figma:
        python3 tools/build_ribbon.py board <борд.png> <ширина> <высота> <слаг> "<Заголовок>"

    photos — из набора фотографий (кейс открывается сразу лентой, без текста):
        python3 tools/build_ribbon.py photos <слаг> "<Заголовок>" <фото1> <фото2> ...

В обоих случаях плитки кладутся абсолютными координатами, и каждая, кроме
последней, на пиксель шире своего места. Иначе при дробном масштабе кадра между
соседними плитками остаётся незакрашенная полоска в полпикселя — те самые белые
полосы поперёк кейса.

data-stops — координаты, на которых заканчивается шаг листания. Для борда это
пустые колонки между блоками, для фотокейса — границы кадров, так что ни один
снимок не оказывается разрезанным.
"""
import os, sys, math
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
TILE = 700
PHOTO_H = 760

PAGE = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  /* Лента в натуральную величину ({w} x {h}). Окно кейса измеряет её и
     масштабирует по своей высоте — так же, как у Санька. */
  html,body{{margin:0;padding:0;background:#fff;overflow:hidden;}}
  .lane{{position:relative;width:{w}px;height:{h}px;}}
  .lane img{{position:absolute;top:0;height:{h}px;display:block;border:0;}}
</style>
</head>
<body>
<div class="lane" data-stops="{stops}">
{imgs}
</div>
</body>
</html>
"""


def write_page(slug, title, w, h, stops, items):
    """items: список (src, left, width) в координатах макета."""
    last = len(items) - 1
    imgs = '\n'.join(
        '  <img src="{src}" style="left:{x}px;width:{w}px" alt="" {ld}>'.format(
            src=src, x=x, w=iw + (0 if i == last else 1),
            ld='fetchpriority="high"' if i < 2 else 'loading="lazy"')
        for i, (src, x, iw) in enumerate(items))
    open('%s-case.html' % slug, 'w', encoding='utf-8').write(
        PAGE.format(title=title, w=w, h=h, stops=','.join(map(str, stops)), imgs=imgs))


# ---------------------------------------------------------------- борд Figma

def gutters(src, bw, pct, mingap, minrun):
    """Колонки, где яркость по вертикали почти не меняется, — там пусто."""
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


def board(args):
    src, bw, bh, slug, title = args[0], int(args[1]), int(args[2]), args[3], args[4]
    outdir = 'cases/%s-ribbon' % slug
    im = Image.open(src).convert('RGB')
    s = im.width / bw
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith('.jpg') and f[0].isdigit():
            os.remove(os.path.join(outdir, f))
    items = []
    for i in range(math.ceil(bw / TILE)):
        x0, x1 = i * TILE, min(bw, (i + 1) * TILE)
        fn = '%02d.jpg' % (i + 1)
        # кроп на пиксель шире, чтобы перекрытие было настоящим, а не растянутым
        im.crop((round(x0 * s), 0, round(min(bw, x1 + 1) * s), im.height)).save(
            os.path.join(outdir, fn), quality=86, optimize=True, progressive=True)
        items.append(('%s/%s' % (outdir, fn), x0, x1 - x0))
    allp = sorted(set(gutters(src, bw, 8, 90, 12)) | set(gutters(src, bw, 30, 60, 5)))
    stops = [allp[0]]
    for p in allp[1:]:
        if p - stops[-1] >= 60:
            stops.append(p)
    if stops[-1] != bw:
        stops.append(bw)
    write_page(slug, title, bw, bh, stops, items)
    size = sum(os.path.getsize(os.path.join(outdir, os.path.basename(f))) for f, _, _ in items)
    d = np.diff(stops)
    print('%s-case.html: %d плиток, %.1f МБ, лента %dx%d, остановок %d (шаг мед %d, макс %d)'
          % (slug, len(items), size / 1e6, bw, bh, len(stops), int(np.median(d)), int(d.max())))


# ------------------------------------------------------------- фотографии

def trim_white(im):
    """Срезает сплошные белые поля по краям файла — на ленте они читаются как
    пустоты между кадрами."""
    a = np.asarray(im.convert('L'), dtype=np.float32)
    white = a > 244
    rows = white.mean(axis=1) > 0.995
    cols = white.mean(axis=0) > 0.995
    t = int(np.argmax(~rows)) if rows.any() else 0
    b = im.height - int(np.argmax(~rows[::-1])) if rows.any() else im.height
    l = int(np.argmax(~cols)) if cols.any() else 0
    r = im.width - int(np.argmax(~cols[::-1])) if cols.any() else im.width
    if b - t < 50 or r - l < 50:
        return im
    return im.crop((l, t, r, b)) if (t or l or b != im.height or r != im.width) else im


def photos(args):
    slug, title, srcs = args[0], args[1], args[2:]
    outdir = 'cases/%s-ribbon' % slug
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith('.jpg') and f[0].isdigit():
            os.remove(os.path.join(outdir, f))
    items, stops, x = [], [0], 0
    for i, src in enumerate(srcs):
        im = trim_white(Image.open(src).convert('RGB'))
        w = max(1, round(im.width * PHOTO_H / im.height))
        im = im.resize((w, PHOTO_H), Image.LANCZOS)
        fn = '%02d.jpg' % (i + 1)
        im.save(os.path.join(outdir, fn), quality=88, optimize=True, progressive=True)
        items.append(('%s/%s' % (outdir, fn), x, w))
        x += w
        stops.append(x)
    write_page(slug, title, x, PHOTO_H, stops, items)
    size = sum(os.path.getsize(os.path.join(outdir, '%02d.jpg' % (i + 1))) for i in range(len(items)))
    print('%s-case.html: %d кадров, %.1f МБ, лента %dx%d' % (slug, len(items), size / 1e6, x, PHOTO_H))


if __name__ == '__main__':
    mode = sys.argv[1]
    {'board': board, 'photos': photos}[mode](sys.argv[2:])
