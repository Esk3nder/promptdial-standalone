#!/bin/bash

# Start both UI dev server and API server

echo "🚀 Starting PromptDial Development Servers..."
echo "================================"

# Function to kill processes on exit
cleanup() {
    echo "Shutting down servers..."
    kill $UI_PID $SERVER_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

# Start UI dev server in background
echo "Starting UI dev server..."
cd packages/ui
npm run dev &
UI_PID=$!

# Wait a bit for UI to start
sleep 3

# Start API server
echo "Starting API server..."
cd ../core
npm run server:ui &
SERVER_PID=$!

echo ""
echo "✅ Servers running:"
echo "   UI: http://localhost:5173"
echo "   API: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for both processes
wait