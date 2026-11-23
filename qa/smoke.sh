#!/usr/bin/env bash
set -euo pipefail
QA=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLIENT="$(CDPATH= cd -- "${CLIENT:-"$QA/../client"}" && pwd)"
NODE=${NODE:-node}
if [[ -z "${GAME_HANDOFF_SANDBOXED:-}" ]]; then
  if [[ "$(uname -s)" != Darwin ]]; then
    echo 'Use an independently network-isolated host, then set GAME_HANDOFF_SANDBOXED=1.' >&2; exit 2
  fi
  exec /usr/bin/sandbox-exec -f "$QA/network-closed.sb" env GAME_HANDOFF_SANDBOXED=1 bash "$0" "$@"
fi
OUT=${OUT:-$(mktemp -d)}
export EXPECT_TRUSTED_LEGACY=1 COW_CLIENT="$CLIENT"
run(){ name=$1;shift; printf 'BEGIN %s\n' "$name"; "$NODE" "$@" >"$OUT/$name.txt" 2>&1 || { tail -25 "$OUT/$name.txt"; return 1; }; printf 'PASS %s\n' "$name"; }
"$NODE" -e 'const s=require("node:net").connect({host:"127.0.0.1",port:65534});s.on("error",e=>{if(!["EPERM","EACCES","ENETUNREACH"].includes(e.code)){console.error("Network isolation not verified:",e.code);process.exitCode=1;}});s.on("connect",()=>{s.destroy();process.exitCode=1;});'
if [[ "${1:-}" == "--quick" ]]; then
  run guide-transient "$QA/guide/guide-transient.cjs" "$CLIENT/art163/ghost/approved-guide-flow.js"
  run particle-colors "$QA/cover/mixed-scope.cjs" "$CLIENT" new
  run high-wave-attack "$QA/engine/baseline-dragon-native.cjs" "$CLIENT"
  exit
fi
run guide-transient "$QA/guide/guide-transient.cjs" "$CLIENT/art163/ghost/approved-guide-flow.js"
for o in portrait landscape; do run "icon-$o" "$QA/guide/icon-proof.cjs" "$CLIENT" "$o" "$OUT/icons-$o.json"; done
mkdir -p "$OUT/corners"
run corner-pixels "$QA/corners/check-pixels.cjs" "$CLIENT/art163/ghost/approved-guide-flow.js" "$OUT/corners" fixed
run corners-portrait "$QA/corners/native-corners.cjs" "$CLIENT" unrelated portrait "$OUT/corner-p.json"
run corners-landscape "$QA/corners/native-corners.cjs" "$CLIENT" skip landscape "$OUT/corner-l.json"
for m in after retry; do
  run "griffin-$m" "$QA/engine/griffin-native.cjs" "$CLIENT" "$m"
  run "troll-$m" "$QA/troll/troll-native.cjs" "$CLIENT" "$m"
done
run particle-colors "$QA/cover/mixed-scope.cjs" "$CLIENT" new
run particle-dense "$QA/cover/round-robin.cjs" "$CLIENT" new
run particle-native "$QA/cover/native-coverage.cjs" "$CLIENT" "$OUT/particle-native" new
run card-visual "$QA/card-fx/native-card-fx.cjs" "$CLIENT" "$OUT/card-visual" new
run card-real-drop "$QA/card-fx/native-card-drop.cjs" "$CLIENT"
run stone-evolution "$QA/card-fx/stone-evolution-boundary.cjs" "$CLIENT"
run stone-cold-warning "$QA/stone/waves.cjs" "$CLIENT" warn-delay
for mode in ally-first self-first solo; do ASSERT_FIXED=1 run "attack-$mode" "$QA/attack/probe.cjs" "$CLIENT" "$OUT/$mode.json" "$mode"; done
run high-wave-attack "$QA/engine/baseline-dragon-native.cjs" "$CLIENT"
run ad-mocks-no-network --test "$QA/recovery/recovery-save.test.cjs"
printf 'Saved new local reports outside client: %s\n' "$OUT"
