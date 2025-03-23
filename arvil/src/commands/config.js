const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { isInProject, getProjectInfo } = require('../utils/project');

/**
 * Configure ARVIL settings
 * This includes OpenAI API keys and Solana network
 */
async function config() {
  console.log(chalk.cyan('ARVIL Configuration\n'));
  
  // Check if we have a global config file already
  const userHomeDir = require('os').homedir();
  const globalConfigPath = path.join(userHomeDir, '.arvil.json');
  
  // Check if project-specific config can be used
  const inProject = isInProject();
  let projectInfo = null;
  if (inProject) {
    try {
      projectInfo = getProjectInfo();
    } catch (error) {
      // Continue with global config
    }
  }
  
  // Load existing configurations
  let globalConfig = {};
  let localConfig = {};
  
  if (fs.existsSync(globalConfigPath)) {
    try {
      globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not parse global config file: ${error.message}`));
    }
  }
  
  if (inProject) {
    const localEnvPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(localEnvPath)) {
      // Parse .env file
      const envContent = fs.readFileSync(localEnvPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          localConfig[match[1]] = match[2];
        }
      });
    }
  }
  
  // Combine configs, local takes precedence
  const combinedConfig = { ...globalConfig, ...localConfig };
  
  // Function to clean API key by removing whitespace and newlines
  const cleanApiKey = (key) => {
    if (!key) return '';
    // Remove all whitespace, newlines, and quotation marks
    return key.replace(/[\s\n'"]+/g, '');
  };
  
  // Prompt for OpenAI API key
  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your OpenAI API key:',
      default: combinedConfig.OPENAI_API_KEY || '',
      mask: '*'
    }
  ]);
  
  // Clean the API key to handle multi-line input and extra characters
  const cleanedApiKey = cleanApiKey(apiKey);
  
  // Validate the OpenAI API key format
  const isValidOpenAIKey = (key) => {
    // Basic format validation
    const pattern = /^(sk-|sk-org-)[a-zA-Z0-9]{20,}$/;
    
    if (!pattern.test(key)) {
      console.log(chalk.yellow('Warning: The API key format may not be valid. OpenAI keys typically start with "sk-" followed by characters.'));
      console.log(chalk.yellow('Proceeding with the provided key, but be aware it might not work with the OpenAI API.'));
      return false;
    }
    return true;
  };
  
  // Validate the cleaned key
  isValidOpenAIKey(cleanedApiKey);
  
  // Prompt for keypair file
  const { keypairPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'keypairPath',
      message: 'Enter path to your Solana keypair file (leave empty to skip):',
      default: combinedConfig.KEYPAIR_PATH || ''
    }
  ]);
  
  // Prompt for network selection
  const { network } = await inquirer.prompt([
    {
      type: 'list',
      name: 'network',
      message: 'Select default Solana network:',
      choices: [
        { name: 'Devnet (recommended for development)', value: 'devnet' },
        { name: 'Testnet', value: 'testnet' },
        { name: 'Mainnet', value: 'mainnet' }
      ],
      default: combinedConfig.SOLANA_NETWORK || 'devnet'
    }
  ]);
  
  // Ask if user wants to save globally
  const { saveGlobally } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveGlobally',
      message: 'Save configuration globally (for all projects)?',
      default: true
    }
  ]);
  
  // Save configs
  if (saveGlobally) {
    // Save to global config
    const newGlobalConfig = {
      ...globalConfig,
      OPENAI_API_KEY: cleanedApiKey,
      KEYPAIR_PATH: keypairPath,
      SOLANA_NETWORK: network
    };
    
    try {
      fs.writeFileSync(globalConfigPath, JSON.stringify(newGlobalConfig, null, 2));
      console.log(chalk.green(`\nConfiguration saved globally to ${globalConfigPath}`));
    } catch (error) {
      console.log(chalk.red(`Error saving global config: ${error.message}`));
    }
  }
  
  // Always save to local .env if in a project
  if (inProject) {
    const localEnvPath = path.join(process.cwd(), '.env');
    
    try {
      // Load existing .env content if it exists
      let envContent = '';
      if (fs.existsSync(localEnvPath)) {
        envContent = fs.readFileSync(localEnvPath, 'utf8');
      }
      
      // Update values
      const updateEnvVar = (content, key, value) => {
        if (!value) return content; // Skip empty values
        
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
          return content.replace(regex, `${key}=${value}`);
        } else {
          return content + (content && !content.endsWith('\n') ? '\n' : '') + `${key}=${value}\n`;
        }
      };
      
      envContent = updateEnvVar(envContent, 'OPENAI_API_KEY', cleanedApiKey);
      envContent = updateEnvVar(envContent, 'KEYPAIR_PATH', keypairPath);
      envContent = updateEnvVar(envContent, 'SOLANA_NETWORK', network);
      
      fs.writeFileSync(localEnvPath, envContent);
      console.log(chalk.green('\nConfiguration saved to local .env file'));
    } catch (error) {
      console.log(chalk.red(`Error saving local config: ${error.message}`));
    }
  } else if (!saveGlobally) {
    console.log(chalk.yellow('\nNot in a project directory, and not saving globally.'));
    console.log(chalk.yellow('Configuration has not been saved.'));
  }
  
  console.log(chalk.green('\nConfiguration complete!'));
}

module.exports = config; 