# ARVIL - Blockchain AI Engineer

![ARVIL Banner](https://github.com/yourusername/arvil/raw/main/docs/assets/arvil-banner.png)

ARVIL (Advanced Robust Virtual Innovation Lab) is an AI-powered CLI tool that helps developers create, deploy, and manage blockchain applications on Solana. It combines the power of AI assistance with blockchain development tools to streamline your workflow.

[![NPM Version](https://img.shields.io/npm/v/arvil-cli.svg?style=flat)](https://www.npmjs.org/package/arvil-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🤖 **AI-Powered Assistance**: Get help with coding, debugging, and optimization
- 🏗️ **Project Scaffolding**: Create new blockchain projects with the right structure
- ⛓️ **Solana Integration**: Deploy and interact with Solana networks
- 💡 **Smart Contract Generation**: Create token contracts, NFTs, and more
- 🛠️ **Development Tools**: Compile, test, and deploy with simple commands

## Installation

```bash
# Install globally with npm
npm install -g arvil-cli

# Or with yarn
yarn global add arvil-cli
```

## Quick Start

```bash
# Set up your configuration
arvil config

# Initialize a new project
arvil init my-blockchain-project
cd my-blockchain-project

# Get AI assistance
arvil assist "Create a simple token contract on Solana"

# Compile your contract
arvil compile

# Deploy to Solana devnet
arvil deploy --network devnet
```

## Commands

| Command | Description |
|---------|-------------|
| `arvil init [name]` | Create a new blockchain project |
| `arvil assist [query]` | Get AI assistance on any blockchain topic |
| `arvil compile` | Compile your smart contracts |
| `arvil deploy` | Deploy your contracts to Solana |
| `arvil test` | Run tests for your project |
| `arvil config` | Configure your API keys and settings |

## Requirements

- Node.js v16+
- OpenAI API key for AI features
- Solana CLI tools for deployment (installed automatically when needed)

## Documentation

For detailed documentation, see:
- [Getting Started Guide](https://github.com/yourusername/arvil/blob/main/GETTING-STARTED.md)
- [Full Documentation](https://github.com/yourusername/arvil#documentation)
- [API Reference](https://github.com/yourusername/arvil/wiki/API-Reference)

## License

MIT 

## New Features in v0.1.5

ARVIL now operates like a Cursor Agent:

- **Automatic Code Implementation**: ARVIL automatically detects and implements code from AI responses
- **Seamless File Creation**: Files are created instantly without prompting
- **Command Execution**: Terminal commands are executed automatically (with safety checks)
- **Smart Filename Detection**: Intelligently extracts filenames from AI responses

### Example Usage

```bash
# Get assistance with creating a Solana token
arvil assist "Create a simple SPL token on Solana"

# ARVIL will automatically:
# 1. Create necessary files (like .env and createToken.js)
# 2. Execute safe terminal commands (like npm install commands)
# 3. Skip potentially unsafe commands that require manual review
``` 