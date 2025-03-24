const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { registerProject } = require('../utils/project');

/**
 * Initialize a new blockchain project
 * @param {string} projectName - Name of the project to create
 */
async function init(projectName) {
  const spinner = ora(`Creating a new blockchain project: ${projectName}`).start();
  
  try {
    // Create project directory
    const projectPath = path.resolve(process.cwd(), projectName);
    
    // Check if directory already exists
    if (fs.existsSync(projectPath)) {
      spinner.fail(`Project directory ${projectName} already exists`);
      
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Directory already exists. Do you want to overwrite it?',
          default: false
        }
      ]);
      
      if (!overwrite) {
        console.log(chalk.red('Project creation aborted.'));
        return;
      }
      
      fs.removeSync(projectPath);
    }

    // Prompt for blockchain platform
    const { blockchain } = await inquirer.prompt([
      {
        type: 'list',
        name: 'blockchain',
        message: 'Select blockchain platform:',
        choices: [
          { name: 'Solana', value: 'solana' },
          { name: 'Ethereum', value: 'ethereum' },
          { name: 'Base', value: 'base' }
        ],
        default: 'solana'
      }
    ]);
    
    fs.mkdirSync(projectPath);
    
    // Create project structure
    fs.mkdirSync(path.join(projectPath, 'src'));
    fs.mkdirSync(path.join(projectPath, 'tests'));
    fs.mkdirSync(path.join(projectPath, 'build'));
    
    // Create package.json based on blockchain platform
    const packageJson = {
      name: projectName,
      version: '0.1.0',
      description: `${blockchain.charAt(0).toUpperCase() + blockchain.slice(1)} blockchain project created with ARVIL`,
      main: 'src/index.js',
      scripts: {
        start: 'node src/index.js',
        test: blockchain === 'solana' ? 'jest' : 'npx hardhat test',
        build: blockchain === 'solana' ? 'arvil compile' : 'npx hardhat compile',
        deploy: `arvil deploy --blockchain ${blockchain}`
      },
      keywords: [
        'blockchain',
        blockchain,
        'web3'
      ],
      author: '',
      license: 'MIT',
      dependencies: {
        'dotenv': '^16.3.1',
        ...(blockchain === 'solana' ? {
          '@solana/web3.js': '^1.78.0',
          '@solana/spl-token': '^0.3.7'
        } : {
          'ethers': '^6.7.0'
        })
      },
      devDependencies: {
        ...(blockchain === 'solana' ? {
          'jest': '^29.5.0'
        } : {
          '@nomicfoundation/hardhat-toolbox': '^3.0.0',
          'hardhat': '^2.17.0'
        })
      }
    };
    
    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create .env file based on blockchain platform
    const envContent = blockchain === 'solana' ? 
      `# Blockchain configuration
SOLANA_PRIVATE_KEY=
SOLANA_NETWORK=devnet

# API Keys
OPENAI_API_KEY=` :
      `# Blockchain configuration
PRIVATE_KEY=
${blockchain.toUpperCase()}_RPC_URL=
ETHERSCAN_API_KEY=

# API Keys
OPENAI_API_KEY=`;
    
    fs.writeFileSync(path.join(projectPath, '.env'), envContent);
    
    // Create .gitignore
    const gitignoreContent = `node_modules
.env
build
dist
coverage
cache
artifacts
typechain-types`;
    
    fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignoreContent);
    
    // Create README.md
    const readmeContent = `# ${projectName}

A ${blockchain.charAt(0).toUpperCase() + blockchain.slice(1)} blockchain project created with ARVIL.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run the application
npm start
\`\`\`

## Project Structure

- \`src/\` - Source code
- \`tests/\` - Test files
- \`build/\` - Compiled contracts

## Development

\`\`\`bash
# Compile contracts
npm run build

# Run tests
npm test

# Deploy to ${blockchain === 'solana' ? 'Solana devnet' : blockchain === 'ethereum' ? 'Ethereum Goerli testnet' : 'Base Goerli testnet'}
npm run deploy
\`\`\`
`;
    
    fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent);
    
    // Create sample source files based on blockchain platform
    if (blockchain === 'solana') {
      const indexContent = `// Solana program entry point
console.log('Solana project initialized.');

// Your code here
`;
      fs.writeFileSync(path.join(projectPath, 'src/index.js'), indexContent);
    } else {
      // Create Hardhat project structure for Ethereum/Base
      const hardhatConfigContent = `require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const privateKey = process.env.PRIVATE_KEY || "";
const rpcUrl = process.env.${blockchain.toUpperCase()}_RPC_URL || "";

module.exports = {
  solidity: "0.8.19",
  networks: {
    ${blockchain === 'ethereum' ? `
    goerli: {
      url: rpcUrl,
      accounts: [privateKey]
    },
    sepolia: {
      url: rpcUrl,
      accounts: [privateKey]
    }` : `
    "base-goerli": {
      url: rpcUrl,
      accounts: [privateKey],
      chainId: 84531
    },
    "base-sepolia": {
      url: rpcUrl,
      accounts: [privateKey],
      chainId: 84532
    }`}
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};`;
      
      fs.writeFileSync(path.join(projectPath, 'hardhat.config.js'), hardhatConfigContent);
      
      // Create contracts directory and sample contract
      fs.mkdirSync(path.join(projectPath, 'contracts'));
      const sampleContract = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleStorage {
    uint256 private value;

    event ValueChanged(uint256 newValue);

    function setValue(uint256 newValue) public {
        value = newValue;
        emit ValueChanged(newValue);
    }

    function getValue() public view returns (uint256) {
        return value;
    }
}`;
      
      fs.writeFileSync(path.join(projectPath, 'contracts/SimpleStorage.sol'), sampleContract);
      
      // Create scripts directory and deploy script
      fs.mkdirSync(path.join(projectPath, 'scripts'));
      const deployScript = `const hre = require("hardhat");

async function main() {
  const SimpleStorage = await hre.ethers.getContractFactory("SimpleStorage");
  const simpleStorage = await SimpleStorage.deploy();

  await simpleStorage.waitForDeployment();

  console.log(
    \`SimpleStorage deployed to \${await simpleStorage.getAddress()}\`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`;
      
      fs.writeFileSync(path.join(projectPath, 'scripts/deploy.js'), deployScript);
    }

    // Register the project
    registerProject(projectName, projectPath, blockchain);
    
    spinner.succeed(`Project ${projectName} created successfully!`);
    
    console.log(chalk.green('\nNext steps:'));
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan('  npm install'));
    if (blockchain !== 'solana') {
      console.log(chalk.cyan('  npx hardhat compile'));
    }
    console.log(chalk.cyan(`  arvil deploy --blockchain ${blockchain}`));
    
  } catch (error) {
    spinner.fail('Project creation failed');
    console.error(chalk.red(error.message));
  }
}

module.exports = init;
