const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const dotenv = require('dotenv');
const os = require('os');

/**
 * Configure ARVIL settings
 */
async function config() {
  // Get existing configuration
  let existingConfig = {};
  
  // Check for .arvil.json in user's home directory
  const globalConfigPath = path.join(os.homedir(), '.arvil.json');
  
  if (fs.existsSync(globalConfigPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
    } catch (error) {
      console.log(chalk.yellow('Warning: Failed to read existing configuration.'));
    }
  }
  
  // Check for local .env file
  let localEnv = {};
  if (fs.existsSync('.env')) {
    localEnv = dotenv.parse(fs.readFileSync('.env'));
  }
  
  // Combine global and local config
  const config = {
    ...existingConfig,
    ...localEnv
  };
  
  console.log(chalk.cyan('ARVIL Configuration\n'));
  
  // Configuration questions
  const questions = [
    {
      type: 'input',
      name: 'OPENAI_API_KEY',
      message: 'Enter your OpenAI API key:',
      default: config.OPENAI_API_KEY || '',
      validate: input => input.trim() === '' ? 'API key is required for AI features' : true
    },
    {
      type: 'input',
      name: 'SOLANA_PRIVATE_KEY',
      message: 'Enter path to your Solana keypair file (leave empty to skip):',
      default: config.SOLANA_PRIVATE_KEY || '',
    },
    {
      type: 'list',
      name: 'SOLANA_NETWORK',
      message: 'Select default Solana network:',
      choices: [
        { name: 'Devnet (recommended for development)', value: 'devnet' },
        { name: 'Testnet', value: 'testnet' },
        { name: 'Mainnet Beta', value: 'mainnet-beta' },
        { name: 'Localnet', value: 'localnet' }
      ],
      default: config.SOLANA_NETWORK || 'devnet'
    },
    {
      type: 'confirm',
      name: 'saveGlobally',
      message: 'Save configuration globally (for all projects)?',
      default: false
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  // Remove non-config fields
  const { saveGlobally, ...configData } = answers;
  
  // Save configuration
  if (saveGlobally) {
    // Save to global config
    fs.writeFileSync(globalConfigPath, JSON.stringify(configData, null, 2));
    console.log(chalk.green(`\nConfiguration saved globally to ${globalConfigPath}`));
  }
  
  // Always save to local .env if in a project directory
  if (fs.existsSync('package.json')) {
    // Create or update .env file
    let envContent = '';
    for (const [key, value] of Object.entries(configData)) {
      envContent += `${key}=${value}\n`;
    }
    
    fs.writeFileSync('.env', envContent);
    console.log(chalk.green('\nConfiguration saved to local .env file'));
    
    // Add .env to .gitignore if it doesn't exist
    if (fs.existsSync('.gitignore')) {
      const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
      if (!gitignoreContent.includes('.env')) {
        fs.appendFileSync('.gitignore', '\n.env\n');
      }
    } else {
      fs.writeFileSync('.gitignore', '.env\n');
    }
  } else if (!saveGlobally) {
    console.log(chalk.yellow('\nNot in a project directory, and not saving globally.'));
    console.log(chalk.yellow('Configuration has not been saved.'));
  }
  
  console.log(chalk.green('\nConfiguration complete!'));
}

module.exports = config; 