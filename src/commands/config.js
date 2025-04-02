const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { isInProject, getProjectInfo } = require('../utils/project');

/**
 * Configure ARVIL settings
 * This includes API keys for different LLM providers and blockchain settings
 */
async function config() {
  console.log(chalk.cyan('ARVIL Configuration\n'));
  
  // Get user home directory for global config
  const userHomeDir = require('os').homedir();
  const globalConfigPath = path.join(userHomeDir, '.arvil.json');
  
  // Check if in project directory
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
  
  // Clean API key helper
  const cleanApiKey = (key) => {
    if (!key) return '';
    return key.replace(/[\s\n\r'"]+/g, '');
  };

  // Prompt for LLM configuration
  const llmQuestions = [
    {
      type: 'list',
      name: 'defaultModel',
      message: 'Select your preferred LLM model:',
      choices: [
        { name: 'Claude 3.7 Sonnet (Anthropic)', value: 'claude-3-sonnet' },
        { name: 'DeepSeek Chat', value: 'deepseek-chat' },
        { name: 'GPT-4 (OpenAI)', value: 'gpt-4' },
        { name: 'GPT-3.5 Turbo (OpenAI)', value: 'gpt-3.5-turbo' }
      ],
      default: combinedConfig.defaultModel || 'gpt-4'
    }
  ];

  const llmAnswers = await inquirer.prompt(llmQuestions);
  
  // Prompt for API keys based on model selection
  const apiKeyQuestions = [];
  
  if (llmAnswers.defaultModel.includes('gpt')) {
    apiKeyQuestions.push({
      type: 'password',
      name: 'OPENAI_API_KEY',
      message: 'Enter your OpenAI API key:',
      default: combinedConfig.OPENAI_API_KEY || '',
      mask: '*'
    });
  }
  
  if (llmAnswers.defaultModel.includes('claude')) {
    apiKeyQuestions.push({
      type: 'password',
      name: 'ANTHROPIC_API_KEY',
      message: 'Enter your Anthropic API key:',
      default: combinedConfig.ANTHROPIC_API_KEY || '',
      mask: '*'
    });
  }
  
  if (llmAnswers.defaultModel.includes('deepseek')) {
    apiKeyQuestions.push({
      type: 'password',
      name: 'DEEPSEEK_API_KEY',
      message: 'Enter your DeepSeek API key:',
      default: combinedConfig.DEEPSEEK_API_KEY || '',
      mask: '*'
    });
  }

  const apiKeyAnswers = await inquirer.prompt(apiKeyQuestions);
  
  // Prompt for blockchain configuration
  const blockchainQuestions = [
    {
      type: 'list',
      name: 'blockchain',
      message: 'Select blockchain platform:',
      choices: ['Solana', 'Ethereum', 'Base'],
      default: combinedConfig.blockchain || 'Solana'
    },
    {
      type: 'list',
      name: 'network',
      message: 'Select default network:',
      choices: (answers) => {
        if (answers.blockchain === 'Solana') {
          return ['Devnet (recommended for development)', 'Testnet', 'Mainnet Beta'];
        } else if (answers.blockchain === 'Ethereum') {
          return ['Goerli (recommended for development)', 'Sepolia', 'Mainnet'];
        } else {
          return ['Base Goerli (recommended for development)', 'Base Sepolia', 'Base Mainnet'];
        }
      },
      default: combinedConfig.network || 'Devnet (recommended for development)'
    }
  ];

  const blockchainAnswers = await inquirer.prompt(blockchainQuestions);
  
  // Save configuration
  const newConfig = {
    ...llmAnswers,
    ...apiKeyAnswers,
    blockchain: blockchainAnswers.blockchain,
    network: blockchainAnswers.network
  };

  // Clean API keys
  Object.keys(newConfig).forEach(key => {
    if (key.includes('API_KEY')) {
      newConfig[key] = cleanApiKey(newConfig[key]);
    }
  });

  // Save globally if requested
  const saveGloballyAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveGlobally',
      message: 'Save configuration globally (for all projects)?',
      default: true
    }
  ]);

  if (saveGloballyAnswer.saveGlobally) {
    await fs.writeJson(globalConfigPath, newConfig, { spaces: 2 });
    console.log(chalk.green(`\nConfiguration saved globally to ${globalConfigPath}`));
  }

  // Save locally if in a project
  if (inProject) {
    const envContent = Object.entries(newConfig)
      .filter(([key]) => key.includes('API_KEY'))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.writeFile(path.join(process.cwd(), '.env'), envContent);
    console.log(chalk.green('\nConfiguration saved to local .env file'));
  }

  console.log(chalk.green('\nConfiguration complete!'));
}

module.exports = config; 