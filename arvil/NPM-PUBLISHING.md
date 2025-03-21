# Publishing ARVIL to npm

This guide walks you through the process of publishing the ARVIL package to npm.

## Prerequisites

1. An npm account. Create one at [npmjs.com](https://www.npmjs.com/signup)
2. Node.js and npm installed locally
3. Logged in to npm on your machine (`npm login`)

## Preparation Steps

1. Update your package information in `package.json`:
   - Ensure the name is unique (we're using `arvil-cli`)
   - Update author information
   - Update repository URLs
   - Check dependencies are correct

2. Run the preparation script:

```bash
cd arvil
./prepare-package.sh
```

This script will:
- Clean up previous builds
- Install dependencies
- Run tests
- Prompt for version updates
- Create a local tarball for testing

## Testing the Package Locally

Before publishing, test your package locally:

```bash
# Install from the local tarball
npm install -g ./arvil-cli-0.1.0.tgz  # Replace with your version

# Verify the installation
arvil --version
arvil --help
```

Test basic functionality to ensure everything works as expected.

## Publishing to npm

When you're ready to publish:

```bash
npm publish
```

This will upload the package to npm, making it available for anyone to install with:

```bash
npm install -g arvil-cli
```

## Updating the Package

To publish updates:

1. Make your changes
2. Update the version (`npm version patch|minor|major`)
3. Run tests
4. Publish again with `npm publish`

## Post-Publishing Steps

After publishing:

1. Update your GitHub repository with the latest code
2. Create a release tag on GitHub matching your npm version
3. Announce the release to your users/community

## Unpublishing

If you need to unpublish a version (only possible within 72 hours of publishing):

```bash
npm unpublish arvil-cli@0.1.0
```

For full unpublishing:

```bash
npm unpublish arvil-cli --force
```

Use these commands with caution, as they can break users' workflows.

## Transferring Ownership

To add maintainers to your package:

```bash
npm owner add <username> arvil-cli
```

## npm Package Policies

Remember to follow npm's policies:
- [Package Name Guidelines](https://docs.npmjs.com/package-name-guidelines)
- [npm Terms of Service](https://www.npmjs.com/policies/terms)
- [npm Code of Conduct](https://www.npmjs.com/policies/conduct) 