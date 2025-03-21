#!/bin/bash

# ARVIL Installation Script
echo "🚀 Installing ARVIL - Blockchain AI Engineer"
echo "============================================="

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

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Make CLI executable
chmod +x src/cli.js src/index.js

# Link the CLI globally
echo "🔗 Linking ARVIL globally..."
npm link

# Success message
echo "✨ ARVIL installed successfully!"
echo ""
echo "To get started, run:"
echo "  arvil config     # Set up your API keys"
echo "  arvil init       # Create a new blockchain project"
echo "  arvil assist     # Get AI assistance"
echo ""
echo "For more information, see the README.md file"
echo "" 