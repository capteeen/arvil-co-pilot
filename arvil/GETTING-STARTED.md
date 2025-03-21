# Getting Started with ARVIL

ARVIL (Advanced Robust Virtual Innovation Lab) is an AI-powered blockchain engineer assistant that helps you develop and deploy Solana smart contracts. This guide will help you get started with ARVIL quickly.

## Installation

### Prerequisites

- Node.js v16 or later
- npm v7 or later
- Solana CLI tools (optional, for deployment)

### Quick Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/arvil.git
cd arvil

# Run the installation script
./install.sh
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/arvil.git
cd arvil

# Install dependencies
npm install

# Link the CLI globally
npm link
```

## Configuration

Before using ARVIL, you should configure your API keys and blockchain settings:

```bash
arvil config
```

This will prompt you for:
- OpenAI API key (required for AI features)
- Solana keypair path (for deployment)
- Default Solana network

## Creating a New Project

```bash
arvil init my-blockchain-project
cd my-blockchain-project
```

This will create a new Solana blockchain project with the basic structure and files needed to get started.

## Getting AI Assistance

You can ask ARVIL for help with any blockchain development task:

```bash
arvil assist "How do I create a simple token contract on Solana?"
```

ARVIL will respond with helpful advice, code snippets, or step-by-step instructions.

## Working with Smart Contracts

### Compiling Your Contract

```bash
arvil compile
```

### Testing Your Contract

```bash
arvil test
```

### Deploying Your Contract

```bash
# Deploy to Solana devnet (default)
arvil deploy

# Deploy to a specific network
arvil deploy --network testnet
```

## Example Workflows

### Creating and Deploying a Token

```bash
# Create a new project
arvil init token-project
cd token-project

# Get assistance with token creation
arvil assist "Create a simple SPL token on Solana"

# Implement the suggested solution when prompted

# Compile the contract
arvil compile

# Deploy to devnet
arvil deploy
```

### Troubleshooting Errors

If you encounter errors in your contract:

```bash
arvil assist "I'm getting this error when deploying: [paste error here]"
```

ARVIL will analyze the error and suggest possible solutions.

## Additional Resources

- [Solana Documentation](https://docs.solana.com/)
- [Solana Program Library](https://spl.solana.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs/) 