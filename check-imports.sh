#!/bin/bash

echo "Checking for incorrect type imports..."

# Check for any remaining non-type imports that should be type imports
echo ""
echo "=== Checking for interface/type imports without 'type' keyword ==="

# Types that should always use 'import type'
TYPES=(
  "PayloadAction"
  "RootState"
  "AppDispatch"
  "QueryResult"
  "Field"
  "ReportSection"
  "DataQuery"
  "Filter"
  "Fund"
  "FundPrice"
  "FundReturn"
  "GridLayout"
  "ReportDefinition"
)

for TYPE in "${TYPES[@]}"; do
  echo ""
  echo "Checking $TYPE imports:"
  grep -r "import {.*$TYPE" /root/BOE/frontend/src/ 2>/dev/null | grep -v "import type" | grep -v node_modules || echo "  ✅ All $TYPE imports use 'type'"
done

echo ""
echo "=== Summary ==="
echo "If any imports were found above, they need to be changed to use 'import type'"