#!/bin/bash

# NPM Publishing Script for ARVIL
echo "🚀 ARVIL NPM Publisher"
echo "======================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: This script must be run from the project root"
  exit 1
fi

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x prepare-package.sh
chmod +x install.sh

# Run the prepare package script
echo "📦 Preparing package..."
./prepare-package.sh

# Ask to publish
echo ""
echo "Do you want to publish to npm now?"
select yn in "Yes" "No"; do
  case $yn in
    Yes)
      echo "📤 Publishing to npm..."
      npm publish
      if [ $? -eq 0 ]; then
        echo "✅ Package published successfully!"
        echo ""
        echo "You can now install it globally with:"
        echo "  npm install -g arvil-cli"
        echo ""
      else
        echo "❌ Publishing failed."
      fi
      break
      ;;
    No)
      echo "👍 You can publish manually when ready with: npm publish"
      break
      ;;
  esac
done

# Done
echo "Complete!" 