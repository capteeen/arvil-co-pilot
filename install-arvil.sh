#!/bin/bash

# ARVIL Easy Installation Script
# This script installs ARVIL globally from npm

echo "🚀 ARVIL - Blockchain AI Engineer Installer"
echo "=========================================="

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "Please install Node.js v16 or later from https://nodejs.org/"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d '.' -f 1)

if [ $NODE_MAJOR -lt 16 ]; then
    echo "❌ Node.js v16 or later is required. You have v$NODE_VERSION"
    echo "Please upgrade Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js v$NODE_VERSION detected"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed."
    echo "Please install npm (it should come with Node.js)"
    exit 1
fi

echo "✅ npm detected"

# Install ARVIL globally
echo "📦 Installing ARVIL from npm..."
npm install -g arvil-cli

# Check if installation was successful
if ! command -v arvil &> /dev/null; then
    echo "❌ Installation failed. Please try again or install manually:"
    echo "npm install -g arvil-cli"
    exit 1
fi

echo "✅ ARVIL installed successfully!"

# Configure ARVIL
echo ""
echo "📝 Would you like to configure ARVIL now? (recommended)"
select yn in "Yes" "No"; do
    case $yn in
        Yes ) 
            arvil config
            break
            ;;
        No ) 
            echo "You can configure ARVIL later with: arvil config"
            break
            ;;
    esac
done

# Success message
echo "✨ ARVIL is now installed on your system!"
echo ""
echo "🚀 To get started, run:"
echo "  arvil init       # Create a new blockchain project"
echo "  arvil assist     # Get AI assistance"
echo ""
echo "📘 For more information, see the documentation at:"
echo "  https://github.com/yourusername/arvil#readme"
echo "" 