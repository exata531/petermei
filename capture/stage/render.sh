#!/usr/bin/env bash
# Render every composition in compositions.json, light and dark, to
# public/img/mock/<name>-<theme>.webp at 2x, and write src/data/mocks.json.
#
#   ./render.sh                 render everything
#   ./render.sh volbase-landing render one composition (both themes)
#   ./render.sh --keep-png      keep the intermediate PNGs
#
# Uses the gstack headless browser on a PRIVATE daemon (own state file, own
# random port) so it never touches anyone else's tabs.

set -euo pipefail

STAGE="$(cd "$(dirname "$0")" && pwd)"
CAPTURE="$(dirname "$STAGE")"
REPO="$(dirname "$CAPTURE")"
OUT="$REPO/public/img/mock"
DATA="$REPO/src/data/mocks.json"
B="${B:-$HOME/.claude/skills/gstack/browse/dist/browse}"
PORT="${STAGE_PORT:-8765}"
SCALE=2

KEEP_PNG=0
ONLY=""
for a in "$@"; do
  case "$a" in
    --keep-png) KEEP_PNG=1 ;;
    *) ONLY="$a" ;;
  esac
done

mkdir -p "$OUT" "$STAGE/.browse"
cd "$REPO"   # the browser only writes screenshots under its cwd
export BROWSE_STATE_FILE="$STAGE/.browse/browse.json"

# --- static server for stage/ + captures ---------------------------------
if ! curl -sf "http://127.0.0.1:$PORT/stage/stage.html" >/dev/null 2>&1; then
  (cd "$CAPTURE" && python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1) &
  SERVER_PID=$!
  trap 'kill $SERVER_PID 2>/dev/null || true; "$B" stop >/dev/null 2>&1 || true' EXIT
  for _ in $(seq 1 40); do
    curl -sf "http://127.0.0.1:$PORT/stage/stage.html" >/dev/null 2>&1 && break
    sleep 0.25
  done
else
  trap '"$B" stop >/dev/null 2>&1 || true' EXIT
fi

# --- private browser daemon ----------------------------------------------
"$B" stop >/dev/null 2>&1 || true
for _ in 1 2 3; do "$B" status >/dev/null 2>&1 && break; sleep 2; done

names=$(python3 -c "import json,sys; [print(c['name']) for c in json.load(open('$STAGE/compositions.json'))['compositions']]")

render_one() {
  local name="$1" theme="$2"
  local canvas w h
  canvas=$(python3 -c "import json; c=[c for c in json.load(open('$STAGE/compositions.json'))['compositions'] if c['name']=='$name'][0]; print(*c.get('canvas',[1600,1000]))")
  w=${canvas% *}; h=${canvas#* }
  "$B" viewport "${w}x${h}" --scale "$SCALE" >/dev/null
  "$B" goto "http://127.0.0.1:$PORT/stage/stage.html?c=$name&theme=$theme" >/dev/null
  "$B" wait "#stage.ready" >/dev/null
  "$B" screenshot --selector "#stage" "$OUT/$name-$theme.png" >/dev/null
  echo "  $name-$theme"
}

echo "rendering to $OUT"
for name in $names; do
  if [ -n "$ONLY" ] && [ "$name" != "$ONLY" ]; then continue; fi
  for theme in light dark; do
    render_one "$name" "$theme"
  done
done

# --- WebP + mocks.json ---------------------------------------------------
python3 - "$STAGE" "$OUT" "$DATA" "$KEEP_PNG" <<'EOF'
import json, os, sys, subprocess, shutil
stage, out, data, keep = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1"
comps = json.load(open(os.path.join(stage, "compositions.json")))["compositions"]
bydesc = {c["name"]: c for c in comps}

def to_webp(png, webp):
    if shutil.which("cwebp"):
        subprocess.run(["cwebp", "-quiet", "-q", "90", "-m", "6", png, "-o", webp], check=True)
        return
    try:
        from PIL import Image
        Image.open(png).convert("RGB").save(webp, "WEBP", quality=90, method=6)
        return
    except ImportError:
        pass
    subprocess.run(["sips", "-s", "format", "webp", png, "--out", webp], check=True, capture_output=True)

def size(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except ImportError:
        r = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path], capture_output=True, text=True).stdout
        vals = [int(l.split()[-1]) for l in r.splitlines() if "pixel" in l]
        return vals[0], vals[1]

for f in sorted(os.listdir(out)):
    if f.endswith(".png"):
        png = os.path.join(out, f)
        to_webp(png, png[:-4] + ".webp")
        if not keep:
            os.remove(png)

mocks = []
for f in sorted(os.listdir(out)):
    if not f.endswith(".webp"):
        continue
    stem = f[:-5]
    name, theme = stem.rsplit("-", 1)
    c = bydesc.get(name)
    if not c:
        continue
    w, h = size(os.path.join(out, f))
    mocks.append({
        "name": name,
        "theme": theme,
        "product": c["product"],
        "src": "/img/mock/" + f,
        "width": w,
        "height": h,
        "description": c.get("desc", ""),
    })
os.makedirs(os.path.dirname(data), exist_ok=True)
json.dump(mocks, open(data, "w"), indent=2)
print(f"wrote {len(mocks)} entries to {data}")
EOF
