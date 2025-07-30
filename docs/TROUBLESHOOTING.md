# PromptDial Troubleshooting Guide

## Common Setup Issues

### 1. Installation Fails

**Problem**: `npm install` fails with dependency errors

**Solutions**:

- Run the setup script: `./install.sh`
- Ensure Node.js 18+ is installed: `node --version`
- Clear npm cache: `npm cache clean --force`
- Delete lock files and reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  rm -rf packages/*/node_modules packages/*/package-lock.json
  npm install
  ```

### 2. Workspace Dependencies Not Found

**Problem**: Error messages about `@promptdial/shared` not found

**Solutions**:

- The workspace dependencies have been updated to use file references
- Run `npm install` in the root directory
- Then run `npm install` in each package directory:
  ```bash
  for pkg in packages/*; do
    (cd "$pkg" && npm install)
  done
  ```

### 3. TypeScript Build Errors

**Problem**: TypeScript compilation fails

**Solutions**:

- Ensure all packages have their dependencies installed
- Build the shared package first:
  ```bash
  cd packages/shared && npm run build
  cd ../..
  ```
- Then build other packages

### 4. Server Won't Start

**Problem**: `npm start` fails or server doesn't respond

**Solutions**:

- Check if port 3000 is already in use: `lsof -i :3000`
- Use a different port: `PORT=8080 npm start`
- Check the logs for errors
- Try the development server: `npm run dev`

### 5. Missing Dependencies

**Problem**: Module not found errors

**Solutions**:

- Run the full setup: `npm run setup`
- Install specific package dependencies:
  ```bash
  cd packages/core && npm install
  cd packages/ui && npm install
  ```

## Quick Fixes

### Complete Reset

```bash
# Clean everything
npm run clean

# Reinstall from scratch
npm run setup

# Start the server
npm start
```

### Verify Installation

```bash
# Check Node version
node --version  # Should be 18+

# Check npm version
npm --version  # Should be 7+

# List installed packages
npm ls
```

### Debug Mode

```bash
# Run with debug logging
DEBUG=* npm start

# Check specific package
cd packages/core && npm test
```

## Still Having Issues?

1. Check the [README.md](README.md) for updated instructions
2. Ensure all prerequisites are installed
3. Try using the standalone mock server: `node index.js`
4. Report issues with full error logs
