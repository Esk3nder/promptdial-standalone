# Manual GitHub Setup Instructions

If you prefer to set up the repository manually or don't have GitHub CLI installed:

## 1. Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `promptdial`
3. Description: `AI Prompt Optimization Engine - Transform basic prompts into optimized, model-specific queries`
4. Make it Public
5. Don't initialize with README, .gitignore, or license (we already have them)
6. Click "Create repository"

## 2. Push Code to GitHub

Run these commands in the `promptdial-standalone` directory:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: PromptDial - AI Prompt Optimization Engine"

# Add your GitHub repository as origin
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/promptdial.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 3. Verify Setup

1. Visit your repository at `https://github.com/YOUR_USERNAME/promptdial`
2. Ensure all files are uploaded
3. Check that the README is displayed

## 4. Install and Test Locally

```bash
# Install dependencies
npm install

# Run tests
npm test

# Try the demo
npm run dev
```

## 5. Enable GitHub Actions (Optional)

GitHub Actions should be enabled by default. The CI workflow will run automatically on push and pull requests.

## 6. Add Topics to Repository (Optional)

On your repository page, click the gear icon next to "About" and add topics:

- `ai`
- `prompt-engineering`
- `prompt-optimization`
- `gpt`
- `claude`
- `typescript`
- `npm-package`

That's it! Your PromptDial repository is now live on GitHub 🎉
