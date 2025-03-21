#!/bin/bash

# Prepare ARVIL package for npm publishing
echo "🚀 Preparing ARVIL package for npm publishing"
echo "============================================="

# Ensure we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: This script must be run from the project root"
  exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "❌ Error: npm is not installed"
  exit 1
fi

# Check if user is logged in to npm
echo "🔍 Checking npm login status..."
NPM_USER=$(npm whoami 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "❌ You are not logged in to npm."
  echo "Please login with: npm login"
  exit 1
fi
echo "✅ Logged in as: $NPM_USER"

# Clean up any previous builds
echo "🧹 Cleaning up..."
rm -rf node_modules package-lock.json

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run tests
echo "🧪 Running tests..."
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Please fix the tests before publishing."
  exit 1
fi

# Check for semver changes
echo "📊 Current package version:"
CURRENT_VERSION=$(npm version | grep arvil-cli | cut -d"'" -f4)
echo "- $CURRENT_VERSION"

# Ask for version update
echo ""
echo "Do you want to update the version?"
select version_type in "patch" "minor" "major" "none"; do
  case $version_type in
    patch|minor|major)
      npm version $version_type
      break
      ;;
    none)
      echo "Keeping version $CURRENT_VERSION"
      break
      ;;
    *)
      echo "Invalid option"
      ;;
  esac
done

# Create a tarball for local testing
echo "📦 Creating tarball for local testing..."
npm pack

# Display publishing instructions
echo ""
echo "✅ Package is ready for publishing!"
echo ""
echo "To publish to npm:"
echo "  npm publish"
echo ""
echo "To test locally before publishing:"
echo "  npm install -g $(ls arvil-cli-*.tgz | tail -n 1)"
echo "" 