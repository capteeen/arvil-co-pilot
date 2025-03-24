const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { isProjectDirectory } = require('../utils/project');

/**
 * Deploy a smart contract
 * @param {Object} options - Deploy options
 */
async function deploy(options) {
  // Check if we're in a project directory
  if (!isProjectDirectory()) {
    console.log(chalk.red('Error: Not in an ARVIL project directory.'));
    console.log(chalk.yellow('Please run this command from the root of an ARVIL project.'));
    return;
  }

  // Load project configuration
  const projectConfig = loadProjectConfig();
  const blockchain = options.blockchain || projectConfig.BLOCKCHAIN_PLATFORM || 'solana';
  const network = options.network || projectConfig.DEFAULT_NETWORK || getDefaultNetwork(blockchain);

  // Validate network based on blockchain platform
  if (!isValidNetwork(blockchain, network)) {
    console.log(chalk.red(`Error: Invalid network "${network}" for ${blockchain}.`));
    console.log(chalk.yellow(`Valid networks for ${blockchain} are: ${getValidNetworks(blockchain).join(', ')}`));
    return;
  }

  // Initialize spinner
  const spinner = ora('Preparing deployment...').start();

  try {
    switch (blockchain) {
      case 'solana':
        await deploySolana(options, spinner);
        break;
      case 'ethereum':
      case 'base':
        await deployEVM(blockchain, options, spinner);
        break;
      default:
        spinner.fail(`Unsupported blockchain platform: ${blockchain}`);
        return;
    }
  } catch (error) {
    spinner.fail('Deployment failed');
    console.error(chalk.red(error.message));
  }
}

/**
 * Deploy a Solana smart contract
 */
async function deploySolana(options, spinner) {
  // Check for Solana CLI
  try {
    await execAsync('solana --version');
    spinner.succeed('Solana CLI is installed');
  } catch (error) {
    spinner.fail('Solana CLI is not installed');
    console.log(chalk.yellow('Please install the Solana CLI:'));
    console.log(chalk.cyan('  sh -c "$(curl -sSfL https://release.solana.com/v1.14.13/install)"'));
    return;
  }

  // Check for private key
  let privateKeyPath = '';
  if (process.env.SOLANA_PRIVATE_KEY) {
    spinner.text = 'Using private key from environment variable...';
    
    // Create temporary keyfile from environment variable
    const tempKeyPath = path.join(process.cwd(), '.temp-keypair.json');
    fs.writeFileSync(tempKeyPath, process.env.SOLANA_PRIVATE_KEY);
    privateKeyPath = tempKeyPath;
  } else {
    spinner.text = 'Checking for Solana keypair...';
    
    try {
      const { stdout } = await execAsync('solana config get keypair');
      privateKeyPath = stdout.split(': ')[1].trim();
      
      if (!fs.existsSync(privateKeyPath)) {
        spinner.fail('Keypair not found');
        console.log(chalk.yellow('Please set up a Solana keypair:'));
        console.log(chalk.cyan('  solana-keygen new -o keypair.json'));
        return;
      }
      
      spinner.succeed(`Found keypair at ${privateKeyPath}`);
    } catch (error) {
      spinner.fail('Failed to get keypair path');
      console.log(chalk.yellow('Please set up a Solana keypair:'));
      console.log(chalk.cyan('  solana-keygen new -o keypair.json'));
      return;
    }
  }

  // Look for build artifacts
  spinner.text = 'Looking for program build artifacts...';
  
  let programPath = '';
  
  // Check common build locations
  const possibleLocations = [
    'target/deploy',
    'build',
    'dist'
  ];
  
  for (const location of possibleLocations) {
    const files = fs.existsSync(location) ? fs.readdirSync(location) : [];
    
    for (const file of files) {
      if (file.endsWith('.so')) {
        programPath = path.join(location, file);
        break;
      }
    }
    
    if (programPath) break;
  }
  
  if (!programPath) {
    spinner.fail('No program build artifact found');
    
    // Prompt to build
    const { shouldBuild } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldBuild',
        message: 'Would you like to build your program first?',
        default: true
      }
    ]);
    
    if (shouldBuild) {
      // Depending on the project type, build differently
      if (fs.existsSync('Cargo.toml')) {
        spinner.text = 'Building Rust program...';
        spinner.start();
        
        try {
          await execAsync('cargo build-bpf');
          
          // Look for the built program
          const buildDir = 'target/deploy';
          const files = fs.readdirSync(buildDir);
          
          for (const file of files) {
            if (file.endsWith('.so')) {
              programPath = path.join(buildDir, file);
              break;
            }
          }
          
          if (!programPath) {
            spinner.fail('Failed to find built program');
            return;
          }
          
          spinner.succeed(`Program built at ${programPath}`);
        } catch (error) {
          spinner.fail('Build failed');
          console.error(chalk.red(error.message));
          return;
        }
      } else {
        spinner.fail('Cannot determine how to build this project');
        console.log(chalk.yellow('Please build the project manually and try again.'));
        return;
      }
    } else {
      return;
    }
  } else {
    spinner.succeed(`Found program at ${programPath}`);
  }

  // Configure network
  spinner.text = `Configuring Solana for ${options.network}...`;
  spinner.start();
  
  try {
    await execAsync(`solana config set --url ${options.network}`);
    spinner.succeed(`Configured for ${options.network}`);
  } catch (error) {
    spinner.fail(`Failed to configure network: ${error.message}`);
    return;
  }

  // Deploy program
  spinner.text = `Deploying program to ${options.network}...`;
  spinner.start();
  
  try {
    const { stdout } = await execAsync(`solana program deploy ${programPath}`);
    
    // Extract program ID
    const programIdLine = stdout.split('\n').find(line => line.includes('Program Id:'));
    const programId = programIdLine ? programIdLine.split(': ')[1].trim() : 'unknown';
    
    spinner.succeed('Program deployed successfully!');
    
    console.log(chalk.green('\nDeployment Information:'));
    console.log(chalk.cyan(`Network: ${options.network}`));
    console.log(chalk.cyan(`Program ID: ${programId}`));
    
    // Save program ID to a deployment file
    const deploymentInfo = {
      programId,
      network: options.network,
      deployedAt: new Date().toISOString(),
      buildPath: programPath
    };
    
    fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log(chalk.green('Deployment information saved to deployment.json'));
    
    // Clean up temporary key file if created
    if (privateKeyPath.includes('.temp-keypair.json')) {
      fs.removeSync(privateKeyPath);
    }
  } catch (error) {
    spinner.fail('Deployment failed');
    console.error(chalk.red(error.message));
    
    // Clean up temporary key file if created
    if (privateKeyPath.includes('.temp-keypair.json')) {
      fs.removeSync(privateKeyPath);
    }
  }
}

/**
 * Deploy an EVM-compatible smart contract
 */
async function deployEVM(blockchain, options, spinner) {
  // Check for required tools
  try {
    await execAsync('npm list hardhat');
    spinner.succeed('Hardhat is installed');
  } catch (error) {
    spinner.fail('Hardhat is not installed');
    console.log(chalk.yellow('Installing required dependencies...'));
    try {
      await execAsync('npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox');
      spinner.succeed('Dependencies installed');
    } catch (error) {
      spinner.fail('Failed to install dependencies');
      console.error(chalk.red(error.message));
      return;
    }
  }

  // Configure network in hardhat.config.js if it doesn't exist
  await configureHardhat(blockchain, options.network);

  // Deploy using Hardhat
  spinner.text = `Deploying to ${blockchain} ${options.network}...`;
  try {
    await execAsync(`npx hardhat run scripts/deploy.js --network ${options.network}`);
    spinner.succeed('Contract deployed successfully!');
  } catch (error) {
    spinner.fail('Deployment failed');
    console.error(chalk.red(error.message));
  }
}

/**
 * Configure Hardhat for the specified network
 */
async function configureHardhat(blockchain, network) {
  const configPath = path.join(process.cwd(), 'hardhat.config.js');
  const envPath = path.join(process.cwd(), '.env');

  // Ensure .env exists and has required variables
  if (!fs.existsSync(envPath)) {
    const envContent = `PRIVATE_KEY=
${blockchain.toUpperCase()}_RPC_URL=
ETHERSCAN_API_KEY=`;
    fs.writeFileSync(envPath, envContent);
  }

  // Create or update hardhat.config.js
  const configContent = `require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const privateKey = process.env.PRIVATE_KEY || "";
const rpcUrl = process.env.${blockchain.toUpperCase()}_RPC_URL || "";

module.exports = {
  solidity: "0.8.19",
  networks: {
    ${getHardhatNetworkConfig(blockchain, network)}
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};`;

  fs.writeFileSync(configPath, configContent);
}

/**
 * Get network configuration for hardhat.config.js
 */
function getHardhatNetworkConfig(blockchain, network) {
  const configs = {
    ethereum: {
      goerli: `goerli: {
        url: process.env.ETHEREUM_RPC_URL,
        accounts: [privateKey]
      }`,
      sepolia: `sepolia: {
        url: process.env.ETHEREUM_RPC_URL,
        accounts: [privateKey]
      }`,
      mainnet: `mainnet: {
        url: process.env.ETHEREUM_RPC_URL,
        accounts: [privateKey]
      }`
    },
    base: {
      'base-goerli': `"base-goerli": {
        url: process.env.BASE_RPC_URL,
        accounts: [privateKey],
        chainId: 84531
      }`,
      'base-sepolia': `"base-sepolia": {
        url: process.env.BASE_RPC_URL,
        accounts: [privateKey],
        chainId: 84532
      }`,
      'base-mainnet': `"base-mainnet": {
        url: process.env.BASE_RPC_URL,
        accounts: [privateKey],
        chainId: 8453
      }`
    }
  };

  return configs[blockchain][network];
}

/**
 * Get valid networks for a blockchain platform
 */
function getValidNetworks(blockchain) {
  const networks = {
    solana: ['devnet', 'testnet', 'mainnet-beta', 'localnet'],
    ethereum: ['goerli', 'sepolia', 'mainnet'],
    base: ['base-goerli', 'base-sepolia', 'base-mainnet']
  };
  return networks[blockchain] || [];
}

/**
 * Check if a network is valid for the given blockchain
 */
function isValidNetwork(blockchain, network) {
  return getValidNetworks(blockchain).includes(network);
}

/**
 * Get default network for a blockchain platform
 */
function getDefaultNetwork(blockchain) {
  const defaults = {
    solana: 'devnet',
    ethereum: 'goerli',
    base: 'base-goerli'
  };
  return defaults[blockchain] || 'devnet';
}

/**
 * Load project configuration from .env and global config
 */
function loadProjectConfig() {
  const config = {};
  
  // Try to load from .env
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        config[key.trim()] = value.trim();
      }
    });
  }

  // Try to load from global config
  const globalConfigPath = path.join(require('os').homedir(), '.arvil.json');
  if (fs.existsSync(globalConfigPath)) {
    try {
      const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
      Object.assign(config, globalConfig);
    } catch (error) {
      // Continue with just env config
    }
  }

  return config;
}

module.exports = deploy; 