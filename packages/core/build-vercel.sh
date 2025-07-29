#!/bin/bash
# Build script for Vercel deployment

echo "Building for Vercel deployment..."

# Clean previous builds
rm -rf vercel-build

# Create build directory
mkdir -p vercel-build

# Copy necessary files
cp tsconfig.vercel.json vercel-build/tsconfig.json
cp -r src vercel-build/
cp -r public vercel-build/
cp .env.example vercel-build/.env.example 2>/dev/null || true

# Create package.json without workspace dependencies
cat > vercel-build/package.json << 'EOF'
{
  "name": "promptdial",
  "version": "1.0.0",
  "description": "AI Prompt Optimization Engine",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.56.0",
    "@google/generative-ai": "^0.24.1",
    "axios": "^1.11.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.0",
    "express": "^4.21.2",
    "openai": "^5.10.1",
    "uuid": "^9.0.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^4.17.21",
    "@types/uuid": "^9.0.8",
    "typescript": "^5.7.3"
  }
}
EOF

# Move to build directory
cd vercel-build

# Install dependencies (no workspace references here)
npm install --no-save --ignore-scripts

# Now copy and build shared package AFTER npm install
mkdir -p node_modules/@promptdial/shared/src
cp -r ../../shared/src/* node_modules/@promptdial/shared/src/
cp ../../shared/package.json node_modules/@promptdial/shared/

# Create a simple tsconfig for shared package
cat > node_modules/@promptdial/shared/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Build shared package first
cd node_modules/@promptdial/shared
npx tsc
cd ../../

# Build TypeScript
npm run build

# Copy public files to dist
cp -r public/* dist/ 2>/dev/null || true

# Create index.js for Vercel entry point in the correct location
cat > index.js << 'EOF'
// Vercel serverless function entry point
const serverModule = require('./vercel-build/dist/server.js');
const app = serverModule.default || serverModule;

// Ensure we export the Express app for Vercel
module.exports = app;
EOF

echo "Build complete!"