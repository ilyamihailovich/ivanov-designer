#!/usr/bin/env bash
# Обновляет метку сборки в подвале, коммитит и публикует.
# Запуск:  ./deploy.sh "что изменилось"
set -e
cd "$(dirname "$0")"

STAMP="BUILD $(date '+%d.%m %H:%M')"
python3 - "$STAMP" <<'PY'
import io, re, sys
stamp = sys.argv[1]
p = 'index.html'
s = io.open(p, encoding='utf-8').read()
s2 = re.sub(r'(<(?:b|span) id="buildStamp"[^>]*>)[^<]*(</(?:b|span)>)', lambda m: m.group(1) + stamp + m.group(2), s, count=1)
if s2 == s:
    print('ВНИМАНИЕ: метка сборки не найдена в index.html')
io.open(p, 'w', encoding='utf-8').write(s2)
PY

MSG="${1:-обновление}"
git add -A
git commit -q -m "$MSG" || { echo "нечего коммитить"; exit 0; }
git push -q origin main
echo "опубликовано: $STAMP — $MSG"
echo "https://ilyamihailovich.github.io/ivanov-designer/"
