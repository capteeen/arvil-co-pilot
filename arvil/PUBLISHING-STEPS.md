# Step-by-Step Guide to Publishing ARVIL on npm

This guide walks you through the exact steps needed to publish ARVIL on npm, making it available to everyone globally via `npm install -g arvil-cli`.

## Prerequisites

1. Create an npm account if you don't have one:
   - Go to [npmjs.com/signup](https://www.npmjs.com/signup)
   - Complete the registration process

2. Install Node.js and npm if you haven't already:
   - Download from [nodejs.org](https://nodejs.org/)

## Step 1: Prepare Your Package

1. Make sure you're in the project directory:
   ```bash
   cd arvil
   ```

2. Edit `package.json` to finalize package details:
   - Update `author` field with your name/email
   - Update `repository` URL to your GitHub repository
   - Double-check dependencies

3. Create necessary files (if not already present):
   - README.md
   - LICENSE
   - .npmignore

## Step 2: Login to npm

1. Log in to your npm account in the terminal:
   ```bash
   npm login
   ```

2. Enter your username, password, and email when prompted

3. Verify you're logged in:
   ```bash
   npm whoami
   ```

## Step 3: Test Your Package Locally

1. Run the preparation script:
   ```bash
   ./prepare-package.sh
   ```

2. Install the package locally:
   ```bash
   npm install -g .
   ```

3. Test basic functionality:
   ```bash
   arvil --version
   arvil --help
   ```

## Step 4: Publish to npm

1. When you're ready to publish:
   ```bash
   npm publish
   ```

2. If this is your first time publishing this package, it should succeed.

3. If you get an error about the package name being taken, you'll need to modify your package name in `package.json`.

## Step 5: Verify Publication

1. Check your package page:
   ```
   https://www.npmjs.com/package/arvil-cli
   ```

2. Try installing it from npm:
   ```bash
   npm install -g arvil-cli
   ```

3. Run it to verify everything works:
   ```bash
   arvil --version
   ```

## Step 6: Update GitHub Repository

1. Push all changes to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for npm publication"
   git push origin main
   ```

2. Create a release on GitHub:
   - Go to your repository
   - Click on "Releases"
   - Create a new release with the same version

## Updating Your Package

When you make changes and want to update your package:

1. Update version in package.json:
   ```bash
   npm version patch  # For bug fixes
   npm version minor  # For new features
   npm version major  # For breaking changes
   ```

2. Test the changes

3. Publish again:
   ```bash
   npm publish
   ```

## Troubleshooting

- **Error: You do not have permission to publish**
  - Make sure you're logged in as the package owner
  - Check the package name isn't already taken

- **Error: No valid package.json found**
  - Make sure you're in the correct directory
  - Verify package.json exists and is formatted correctly

- **Error: Package version already exists**
  - Update the version in package.json before publishing 