#!/bin/bash

# Start the PromptDial UI development server

echo "Starting PromptDial UI..."
cd packages/ui

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the development server
npm run dev