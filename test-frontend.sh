#!/bin/bash

echo "Testing BOE Frontend..."

# Check if frontend is running
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend is accessible at http://localhost:5173"
else
    echo "❌ Frontend is not accessible"
    exit 1
fi

# Check for recent compilation errors (last 20 lines only)
if docker logs boe-frontend --tail=20 2>&1 | grep -i "error" | grep -v "Deprecation"; then
    echo "❌ Compilation errors found"
    exit 1
else
    echo "✅ No compilation errors"
fi

echo ""
echo "Frontend is running successfully!"
echo "Open http://localhost:5173 in your browser to test:"
echo "1. Drag a field from the left panel"
echo "2. Drop it on the canvas to create a table"
echo "3. See the data rendered in the table"