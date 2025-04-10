# ARVIL - Multi-Chain AI Engineer

![ARVIL Banner](https://github.com/capteeen/arvil-co-pilot/raw/main/docs/assets/arvil-banner.png)

ARVIL (Advanced Robust Virtual Innovation Lab) is an AI-powered CLI tool that helps developers create, deploy, and manage blockchain applications across multiple chains including Solana, Ethereum, and Base. It combines the power of AI assistance with blockchain development tools to streamline your workflow.

[![NPM Version](https://img.shields.io/npm/v/arvil-cli.svg?style=flat)](https://www.npmjs.org/package/arvil-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🤖 **AI-Powered Assistance**: Get help with coding, debugging, and optimization
- 🏗️ **Multi-Chain Support**: Build on Solana, Ethereum, and Base networks
- ⛓️ **Flexible Deployment**: Deploy to any supported network with simple commands
- 💡 **Smart Contract Generation**: Create tokens, NFTs, and custom contracts
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

# Initialize a new project (select your preferred blockchain)
arvil init my-blockchain-project
cd my-blockchain-project

# Get AI assistance
arvil assist "Create a simple token contract"

# Compile your contract
npm run build

# Deploy to your chosen network
arvil deploy --blockchain <solana|ethereum|base> --network <network>
```

## Supported Networks

### Solana
- Devnet (recommended for development)
- Testnet
- Mainnet Beta

### Ethereum
- Goerli Testnet (recommended for development)
- Sepolia Testnet
- Mainnet

### Base
- Base Goerli Testnet (recommended for development)
- Base Sepolia Testnet
- Base Mainnet

## Commands

| Command | Description |
|---------|-------------|
| `arvil init [name]` | Create a new blockchain project |
| `arvil assist [query]` | Get AI assistance on any blockchain topic |
| `arvil compile` | Compile your smart contracts |
| `arvil deploy` | Deploy your contracts to any supported network |
| `arvil test` | Run tests for your project |
| `arvil config` | Configure your API keys and settings |

## Requirements

- Node.js v16+
- OpenAI API key for AI features
- Network-specific requirements:
  - Solana: Solana CLI tools (installed automatically)
  - Ethereum/Base: Private key and RPC URL

## Documentation

For detailed documentation, see:
- [Getting Started Guide](https://github.com/capteeen/arvil-co-pilot/blob/main/GETTING-STARTED.md)
- [Full Documentation](https://github.com/capteeen/arvil-co-pilot#documentation)
- [API Reference](https://github.com/capteeen/arvil-co-pilot/wiki/API-Reference)

## License

MIT 

## New Features in v0.3.0

ARVIL now supports multiple blockchain networks:

- **Multi-Chain Support**: Build and deploy on Solana, Ethereum, and Base networks
- **Network Selection**: Choose your preferred blockchain during project initialization
- **Flexible Configuration**: Set different networks for development and production
- **Smart Contract Templates**: Get started quickly with chain-specific templates
- **Hardhat Integration**: Seamless development experience for EVM chains

### Example Usage

```bash
# Create a new Ethereum project
arvil init my-eth-project
# Select 'ethereum' when prompted for blockchain

# Create a new Base project
arvil init my-base-project
# Select 'base' when prompted for blockchain

# Deploy to different networks
arvil deploy --blockchain ethereum --network goerli
arvil deploy --blockchain base --network base-goerli
arvil deploy --blockchain solana --network devnet
```

### Network Configuration

Each blockchain platform comes with its own configuration:

```bash
# Ethereum/Base Configuration
PRIVATE_KEY=your_private_key
ETHEREUM_RPC_URL=your_ethereum_rpc_url
BASE_RPC_URL=your_base_rpc_url
ETHERSCAN_API_KEY=your_etherscan_key

# Solana Configuration
SOLANA_PRIVATE_KEY=your_solana_keypair
SOLANA_NETWORK=devnet
```

### Project Structure

Projects are now organized based on the selected blockchain:

```
my-project/
├── src/                 # Source code
├── contracts/          # Smart contracts (Ethereum/Base)
├── scripts/           # Deployment scripts
├── tests/            # Test files
├── hardhat.config.js  # Hardhat config (Ethereum/Base)
└── package.json
```

## Previous Features

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

## New Features in v0.1.7

ARVIL now includes smart error resolution:

- **Automatic Error Detection**: ARVIL detects errors during command execution and file creation
- **AI-Powered Error Analysis**: Analyzes error messages to determine the root cause
- **Automatic Resolution**: Applies fixes automatically without user intervention
- **Command Retry**: After fixing issues, automatically retries failed commands

### Example Error Resolution

```bash
# If a command fails with an error:
arvil assist "Create a React dApp that connects to Solana"

# ARVIL will:
# 1. Detect the error automatically
# 2. Use AI to analyze the error and determine a solution
# 3. Apply necessary fixes (install missing dependencies, fix config issues)
# 4. Retry the original command if appropriate
```

## Features in v0.1.6

ARVIL operates like a Cursor Agent: 

## New Features in v0.1.8

ARVIL now intelligently handles sensitive information:

- **Smart Placeholder Detection**: Automatically identifies when sensitive information like private keys is needed
- **Interactive User Prompting**: Securely prompts for sensitive information in the terminal
- **Automatic File Updates**: Updates configuration files with user-provided values
- **Environment Variable Management**: Manages .env files to store sensitive information securely

### Example User Prompting

```bash
# When ARVIL detects that sensitive information is needed:
arvil assist "Create a Solana wallet and token"

# ARVIL will:
# 1. Detect placeholders for private keys, API keys, wallet addresses, etc.
# 2. Securely prompt you for the information in the terminal
# 3. Save the information to your .env file automatically
# 4. Use the provided values in generated files and commands
```

## New Features in v0.1.9

ARVIL now intelligently manages project paths:

- **Project Registry**: Automatically keeps track of created projects and their locations
- **Path Awareness**: Understands project boundaries to prevent file creation mixups
- **Context-Aware File Creation**: Creates files in the correct locations relative to the project root
- **Project Detection**: Warns when running commands outside of a project directory

### Example Project Awareness

```bash
# ARVIL now recognizes when you're working in a project
arvil assist "Create a new Solana program"

# You'll see:
# Working in project: my-blockchain-project (solana)

# ARVIL will:
# 1. Create files in the correct project directories
# 2. Maintain project boundaries to prevent path mixups
# 3. Track project usage for better context awareness
```

## New Features in v0.2.0

ARVIL now has improved Cursor-like terminal error handling:

- **Smart Error Resolution**: Only attempts unique solutions instead of repeating the same fix
- **Specialized Error Handlers**: Targeted fixers for common issues like ESLint configuration and npm dependencies
- **Progressive Resolution**: Attempts increasingly specific solutions until the problem is solved
- **Persistent Command Tracking**: Remembers which commands have been attempted to avoid loops
- **Human-Like Terminal Interaction**: Provides clearer feedback during the error resolution process

### Example Improved Error Handling

```bash
# When ARVIL encounters an error, it now:
arvil assist "Create an ESLint config for my project"

# ARVIL will:
# 1. Analyze the specific error type (ESLint, npm, file permissions, etc.)
# 2. Try a targeted fix based on the error category
# 3. Track attempted solutions to avoid repetition
# 4. Progressively apply more specific fixes if needed
# 5. Provide clear feedback throughout the process
```

## Bugfixes in v0.2.1

ARVIL's terminal error handling and file creation has been improved:

- **Better .env File Handling**: Properly formats environment variables from code blocks
- **Improved API Key Validation**: Handles multi-line keys and validates format
- **Enhanced Error Resolution**: Smarter approach to fixing ESLint configuration issues
- **Command Execution Fixes**: Resolves issues with trailing backslashes in multi-line commands
- **Duplicate Command Prevention**: Avoids repeatedly executing the same command

### Example

```bash
# When creating a token on Solana, ARVIL will now:
arvil assist "Create a simple SPL token on Solana"

# ARVIL correctly:
# 1. Creates .env files with proper KEY=VALUE format
# 2. Handles multi-line command execution without syntax errors
# 3. Properly determines appropriate file types based on content
# 4. Avoids repeatedly trying the same solutions for errors
```

## New Features in v0.2.2

ARVIL now provides detailed execution summaries:

- **Execution Statistics**: Track successful and failed commands and file operations
- **Detailed Command Log**: See a history of all executed commands with status indicators
- **Error Resolution Stats**: View how many errors were detected and resolved
- **File Operation Details**: List all created, updated, and failed files
- **Time Tracking**: See how long your ARVIL operations took to complete

### Example Execution Summary

```
┌─────────────────────────────────────┐
│           EXECUTION SUMMARY          │
└─────────────────────────────────────┘
Commands:
  ✓ Successful: 3
  ✗ Failed: 1

Files:
  ✓ Created: 2
  ⟳ Updated: 0
  ✗ Failed: 0

Errors:
  ⚠ Detected: 1
  ✓ Resolved: 1
  ✗ Unresolved: 0

Time:
  ⏱ Elapsed: 12 seconds

Command Details:
  ✓ npm init -y
  ✓ npm install @solana/web3.js @solana/spl-token dotenv
  ✗ node createToken.js
  ✓ npm install @solana/web3.js

File Details:
  ✓ Created: createToken.js
  ✓ Created: connection.js
──────────────────────────────────────
```

## Usability Improvements in v0.2.3

ARVIL now has improved input handling for sensitive information:

- **Password Masking**: API keys and private keys now show asterisks (*) during input
- **Better Input Visibility**: See what you're typing without exposing sensitive information  
- **Enhanced Security**: Maintains security while improving usability
- **Consistent Masking**: Applied to all sensitive information prompts throughout ARVIL

### Example Input Experience

```
? Enter your OpenAI API key: ********************************
? Enter your Solana private key: ********************
```

## Repository Update in v0.2.4

ARVIL has moved to a new official repository:

- **Updated Repository**: Now hosted at [github.com/capteeen/arvil-co-pilot](https://github.com/capteeen/arvil-co-pilot)
- **Documentation Links**: All documentation links now point to the correct repository
- **Issue Reporting**: Bug reports can now be submitted to the proper location
- **Package Metadata**: NPM package information updated for better discoverability 

## API Key Handling in v0.2.5

ARVIL now has improved handling for OpenAI API keys:

- **Multi-line Key Support**: Properly handles API keys that span multiple lines
- **Whitespace Cleanup**: Automatically removes any whitespace, newlines or special characters from API keys
- **Better Validation**: Improved validation of API key format
- **Configuration Storage**: Properly stores and loads API keys from global config
- **Enhanced Error Messages**: Clearer error messages when API keys are invalid 