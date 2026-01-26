#!/bin/bash
# Serve ZK circuits for React Native development
# Run this script and set DCID_CIRCUITS_URL=http://<your-ip>:8082 in .env

# Get the local IP address
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
PORT=8082
CIRCUITS_DIR="../../dist/circuits"

if [ ! -d "$CIRCUITS_DIR" ]; then
  echo "Error: Circuits directory not found at $CIRCUITS_DIR"
  echo "Run 'npm run build' in the SDK root first"
  exit 1
fi

echo "Serving circuits from $CIRCUITS_DIR"
echo ""
echo "Add this to your .env file:"
echo "DCID_CIRCUITS_URL=http://$IP:$PORT"
echo ""
echo "Press Ctrl+C to stop"

cd "$CIRCUITS_DIR"
python3 -m http.server $PORT --bind 0.0.0.0
