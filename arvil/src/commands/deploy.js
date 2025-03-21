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
 * Deploy a Solana smart contract
 * @param {Object} options - Deploy options
 */
async function deploy(options) {
  // Check if we're in a project directory
  if (!isProjectDirectory()) {
    console.log(chalk.red('Error: Not in an ARVIL project directory.'));
    console.log(chalk.yellow('Please run this command from the root of an ARVIL project.'));
    return;
  }

  // Validate network
  const validNetworks = ['devnet', 'testnet', 'mainnet-beta', 'localnet'];
  if (!validNetworks.includes(options.network)) {
    console.log(chalk.red(`Error: Invalid network "${options.network}".`));
    console.log(chalk.yellow(`Valid networks are: ${validNetworks.join(', ')}`));
    return;
  }

  // Check for Solana CLI
  const spinner = ora('Checking Solana CLI installation...').start();
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

module.exports = deploy; 