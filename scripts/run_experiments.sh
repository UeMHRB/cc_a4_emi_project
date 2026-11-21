#!/usr/bin/env bash
# Runs 5 request rates x 3 replica counts, 60 s each. Re-running skips finished runs.
set -u
cd "$(dirname "$0")/.."
OUT=results/m4
mkdir -p "$OUT/raw"
SUMMARY="$OUT/summary.csv"
[ -f "$SUMMARY" ] || echo "replicas,rate,avg_resp_ms,errors,replies_2xx,requests_sent" > "$SUMMARY"

kubectl delete hpa emi-web -n emi --ignore-not-found

for N in 1 2 3; do
  kubectl scale deployment emi-web --replicas=$N -n emi
  kubectl rollout status deployment/emi-web -n emi
  sleep 15
  for R in 10 25 50 100 200; do
    TAG="rep${N}_rate${R}"
    [ -f "$OUT/raw/$TAG.httperf.txt" ] && continue
    echo "$(date +%T) starting $TAG"
    python3 scripts/gen_sessions.py $((R * 60)) > "$OUT/raw/$TAG.sessions"
    python3 scripts/profile.py "$OUT/raw/$TAG" &
    PROF=$!
    httperf --hog --server emi.local --port 80 --wsesslog=$((R * 60)),0,"$OUT/raw/$TAG.sessions" \
      --rate=$R --timeout=5 --add-header='Content-Type: application/json\n' \
      > "$OUT/raw/$TAG.httperf.txt" 2>&1
    kill -TERM $PROF; wait $PROF
    python3 scripts/parse_httperf.py "$OUT/raw/$TAG.httperf.txt" $N $R | tee -a "$SUMMARY"
    sleep 30
  done
done
echo "$(date +%T) all runs finished"
