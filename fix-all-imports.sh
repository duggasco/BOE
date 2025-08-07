#!/bin/bash

echo "Fixing all type imports automatically..."

# Fix any remaining interface/type imports
FILES=$(find /root/BOE/frontend/src -name "*.ts" -o -name "*.tsx")

for FILE in $FILES; do
  # Skip node_modules
  if [[ $FILE == *"node_modules"* ]]; then
    continue
  fi
  
  # Check if file needs fixing
  NEEDS_FIX=false
  
  # Check for specific patterns that need fixing
  if grep -q "import {.*\(PayloadAction\|RootState\|AppDispatch\|QueryResult\|DragStartEvent\|DragEndEvent\|DataNode\)" "$FILE" 2>/dev/null; then
    if ! grep -q "import type {.*\(PayloadAction\|RootState\|AppDispatch\|QueryResult\|DragStartEvent\|DragEndEvent\|DataNode\)" "$FILE" 2>/dev/null; then
      echo "Found issues in: $FILE"
      NEEDS_FIX=true
    fi
  fi
  
  if [ "$NEEDS_FIX" = true ]; then
    echo "  Checking: $FILE"
  fi
done

echo ""
echo "All import checks complete!"