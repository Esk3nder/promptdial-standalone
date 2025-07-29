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

# Copy and build shared package
mkdir -p vercel-build/node_modules/@promptdial/shared/src
cp -r ../shared/src/* vercel-build/node_modules/@promptdial/shared/src/
cp ../shared/package.json vercel-build/node_modules/@promptdial/shared/

# Create a simple tsconfig for shared package
cat > vercel-build/node_modules/@promptdial/shared/tsconfig.json << 'EOF'
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

# Build shared package first
cd node_modules/@promptdial/shared
npx tsc
cd ../../../

# Build TypeScript
npm run build

# Copy public files to dist
cp -r public/* dist/ 2>/dev/null || true

# Create index.js for Vercel entry point
cat > ../index.js << 'EOF'
module.exports = require('./vercel-build/dist/server.js');
EOF

echo "Build complete!"