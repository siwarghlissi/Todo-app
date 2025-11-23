#!/bin/bash

TARGET_URL="http://localhost:3000"
REPORT_DIR="./security/reports"

mkdir -p $REPORT_DIR

echo " Starting OWASP ZAP Baseline Scan..."

docker run --rm \
  --network host \
  -v $(pwd)/security/reports:/zap/wrk/:rw \
  owasp/zap2docker-stable zap-baseline.py \
  -t $TARGET_URL \
  -r zap-report.html \
  -J zap-report.json \
  -w zap-report.md \
  -I

echo " Scan done. Reports in security/reports/"
