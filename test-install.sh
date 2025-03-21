#!/bin/bash

# Test installation script for ARVIL
echo "🧪 Testing ARVIL installation"
echo "============================"

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
echo "📁 Created temp directory: $TEMP_DIR"

# Copy ARVIL to the temp directory
echo "📋 Copying ARVIL to temp directory..."
cp -r arvil/* $TEMP_DIR/

# Enter the temp directory
cd $TEMP_DIR

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Make CLI executable
chmod +x src/cli.js src/index.js

# Test CLI help
echo "🔍 Testing CLI help..."
node src/cli.js --help

# Test CLI version
echo "🔍 Testing CLI version..."
node src/cli.js --version

# Run tests if Jest is installed
if [ -d "node_modules/jest" ]; then
  echo "🧪 Running tests..."
  npm test
fi

echo "✅ Installation test complete!"
echo "Temporary directory: $TEMP_DIR"

# Return to original directory
cd -

echo "To clean up:"
echo "  rm -rf $TEMP_DIR" 