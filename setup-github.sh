#!/bin/bash

# PromptDial GitHub Repository Setup Script
# This script will create a new GitHub repository and push the code

echo "🚀 PromptDial GitHub Setup"
echo "========================="

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
    exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI is not installed."
    echo "Install it from: https://cli.github.com/"
    echo ""
    echo "Or you can manually create the repository:"
    echo "1. Go to https://github.com/new"
    echo "2. Create a repository named 'promptdial'"
    echo "3. Run the manual setup commands below"
    exit 1
fi

# Initialize git repository
echo "📦 Initializing git repository..."
git init

# Add all files
git add .
git commit -m "Initial commit: PromptDial - AI Prompt Optimization Engine"

# Create GitHub repository
echo ""
echo "📝 Creating GitHub repository..."
echo "Please enter your GitHub username:"
read -r GITHUB_USERNAME

# Create the repository using gh CLI
gh repo create "$GITHUB_USERNAME/promptdial" \
  --public \
  --description "AI Prompt Optimization Engine - Transform basic prompts into optimized, model-specific queries" \
  --source=. \
  --remote=origin \
  --push

echo ""
echo "✅ Repository created successfully!"
echo "🔗 Your repository: https://github.com/$GITHUB_USERNAME/promptdial"
echo ""
echo "📋 Next steps:"
echo "1. Install dependencies: npm install"
echo "2. Run tests: npm test"
echo "3. Try the demo: npm run dev"
echo ""
echo "🎉 Happy prompting!"