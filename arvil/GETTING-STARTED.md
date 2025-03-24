# Getting Started with ARVIL

ARVIL (Advanced Robust Virtual Innovation Lab) is an AI-powered blockchain engineer assistant that helps you develop and deploy smart contracts on multiple blockchain networks including Solana, Ethereum, and Base. This guide will help you get started with ARVIL quickly.

## Installation

### Prerequisites

- Node.js v16 or later
- npm v7 or later
- Network-specific requirements:
  - Solana: Solana CLI tools (optional, installed automatically when needed)
  - Ethereum/Base: Access to RPC endpoints

### Quick Installation

```bash
# Install globally with npm
npm install -g arvil-cli
```

## Configuration

Before using ARVIL, you should configure your API keys and blockchain settings:

```bash
arvil config
```

This will prompt you for:
- OpenAI API key (required for AI features)
- Blockchain platform selection (Solana, Ethereum, or Base)
- Network selection for your chosen platform
- Platform-specific settings:
  - Solana: Keypair path
  - Ethereum/Base: Private key and RPC URLs

## Creating a New Project

```bash
arvil init my-blockchain-project
cd my-blockchain-project
```

You'll be prompted to select your preferred blockchain platform:
- Solana: Creates a Solana program project
- Ethereum: Creates a Hardhat-based Ethereum project
- Base: Creates a Hardhat-based Base project

## Getting AI Assistance

You can ask ARVIL for help with any blockchain development task:

```bash
# For Solana
arvil assist "How do I create a simple SPL token?"

# For Ethereum
arvil assist "How do I create an ERC20 token?"

# For Base
arvil assist "How do I deploy my contract to Base Goerli?"
```

ARVIL will respond with helpful advice, code snippets, or step-by-step instructions.

## Working with Smart Contracts

### Compiling Your Contract

```bash
# For all platforms
npm run build
```

### Testing Your Contract

```bash
npm test
```

### Deploying Your Contract

```bash
# Deploy to Solana devnet
arvil deploy --blockchain solana --network devnet

# Deploy to Ethereum Goerli
arvil deploy --blockchain ethereum --network goerli

# Deploy to Base Goerli
arvil deploy --blockchain base --network base-goerli
```

## Example Workflows

### Creating and Deploying a Token

#### Solana SPL Token
```bash
# Create a new Solana project
arvil init spl-token
cd spl-token

# Get assistance with token creation
arvil assist "Create a simple SPL token"

# Deploy to devnet
arvil deploy --blockchain solana --network devnet
```

#### Ethereum ERC20 Token
```bash
# Create a new Ethereum project
arvil init erc20-token
cd erc20-token

# Get assistance with token creation
arvil assist "Create an ERC20 token"

# Deploy to Goerli testnet
arvil deploy --blockchain ethereum --network goerli
```

#### Base Token
```bash
# Create a new Base project
arvil init base-token
cd base-token

# Get assistance with token creation
arvil assist "Create a token on Base"

# Deploy to Base Goerli testnet
arvil deploy --blockchain base --network base-goerli
```

### Troubleshooting Errors

If you encounter errors in your contract:

```bash
arvil assist "I'm getting this error when deploying: [paste error here]"
```

ARVIL will analyze the error and suggest possible solutions.

## Project Structure

### Solana Projects
```
my-solana-project/
├── src/
│   └── program.rs      # Solana program
├── tests/
└── build/
```

### Ethereum/Base Projects
```
my-evm-project/
├── contracts/          # Smart contracts
├── scripts/           # Deployment scripts
├── test/             # Test files
└── hardhat.config.js  # Network configuration
```

## Additional Resources

- [Solana Documentation](https://docs.solana.com/)
- [Ethereum Documentation](https://ethereum.org/developers)
- [Base Documentation](https://docs.base.org)
- [OpenAI API Documentation](https://platform.openai.com/docs/) 