#!/bin/bash
BAD_IMPORTS="e-teyvat siduri postgres drizzle neon next express http"
FAILED=0
for bad in $BAD_IMPORTS; do
  if grep -riq "$bad" src/; then
    echo "ERROR: Found illegal dependency '$bad' in src/"
    FAILED=1
  fi
done
if [ $FAILED -eq 0 ]; then
  echo "Dependency check passed. No illegal imports found."
fi
exit $FAILED
