#!/bin/bash
# Build script for Vercel deployment

echo "Building for Vercel deployment..."

# Clean previous builds
rm -rf vercel-build

# Create build directory
mkdir -p vercel-build

# Copy necessary files
cp package.json vercel-build/
cp tsconfig.json vercel-build/
cp -r src vercel-build/
cp -r public vercel-build/
cp .env.example vercel-build/.env.example 2>/dev/null || true

# Move to build directory
cd vercel-build

# Install dependencies (no workspace references here)
npm install

# Build TypeScript
npm run build

# Copy public files to dist
cp -r public/* dist/ 2>/dev/null || true

echo "Build complete!"