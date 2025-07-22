#!/bin/bash

echo "🚀 PromptDial Setup Script"
echo "========================="
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18 or higher is required (found v$NODE_VERSION)"
    exit 1
fi

echo "✅ Node.js version check passed"
echo ""

# Clean install
echo "🧹 Cleaning previous installations..."
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules packages/*/package-lock.json
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install workspace dependencies
echo "📦 Installing workspace dependencies..."
for pkg in packages/*; do
    if [ -d "$pkg" ] && [ -f "$pkg/package.json" ]; then
        echo "  Installing $pkg..."
        (cd "$pkg" && npm install)
    fi
done

echo ""
echo "✅ Installation complete!"
echo ""
echo "To start PromptDial:"
echo "  npm start        # Start the standalone server"
echo "  npm run dev      # Start the core development server"
echo "  npm run start:ui # Start the UI development server"
echo ""