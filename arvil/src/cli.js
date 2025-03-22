#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const inquirer = require('inquirer');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Version
const VERSION = '0.1.7';

// Add error handling to prevent crashes
process.on('uncaughtException', (error) => {
  // Only show errors for commands other than --version or --help
  const isVersionOrHelp = process.argv.includes('--version') || 
                          process.argv.includes('-V') ||
                          process.argv.includes('--help') ||
                          process.argv.includes('-h');
  
  if (!isVersionOrHelp) {
    console.error(chalk.red('Error: ') + error.message);
    
    if (error.message.includes('OPENAI_API_KEY')) {
      console.log(chalk.yellow('\nPlease set your OpenAI API key by running:'));
      console.log(chalk.cyan('  arvil config'));
    }
  }
  
  // For version and help commands, allow normal processing
  if (!isVersionOrHelp) {
    process.exit(1);
  }
});

// Import commands - Wrapped in try/catch to prevent crashes on version/help
let init, deploy, assist, compile, test, config;
try {
  init = require('./commands/init');
  deploy = require('./commands/deploy');
  assist = require('./commands/assist');
  compile = require('./commands/compile');
  test = require('./commands/test');
  config = require('./commands/config');
} catch (error) {
  // Silently fail for version/help commands
  if (!(process.argv.includes('--version') || 
        process.argv.includes('-V') ||
        process.argv.includes('--help') ||
        process.argv.includes('-h'))) {
    console.error(chalk.red('Error loading commands: ') + error.message);
    process.exit(1);
  }
}

// Check if OpenAI API key is set
const checkApiKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.yellow('Warning: OPENAI_API_KEY is not set. Some features may not work properly.'));
    console.log(chalk.yellow('Run `arvil config` to set up your API keys.'));
  }
};

// Display banner
try {
  console.log(
    chalk.cyan(
      figlet.textSync('ARVIL', { horizontalLayout: 'full' })
    )
  );
  console.log(chalk.cyan(`Blockchain AI Engineer - v${VERSION}\n`));
} catch (error) {
  // Fallback if figlet fails
  console.log(chalk.cyan('ARVIL - Blockchain AI Engineer'));
  console.log(chalk.cyan(`Version ${VERSION}\n`));
}

// Check API key
checkApiKey();

// Define CLI commands
program
  .version(VERSION)
  .description('ARVIL - Blockchain AI Engineer Assistant');

// Only add command handlers if they loaded successfully
if (init) {
  // Init command
  program
    .command('init [projectName]')
    .description('Initialize a new blockchain project')
    .action(async (projectName) => {
      if (!projectName) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectName',
            message: 'What is the name of your project?',
            default: 'my-blockchain-project'
          }
        ]);
        projectName = response.projectName;
      }
      
      init(projectName);
    });
}

if (deploy) {
  // Deploy command
  program
    .command('deploy')
    .description('Deploy your smart contract to the blockchain')
    .option('-n, --network <network>', 'Network to deploy to', 'devnet')
    .action((options) => {
      deploy(options);
    });
}

if (assist) {
  // Assist command
  program
    .command('assist [query]')
    .description('Get AI assistance for a specific task')
    .action(async (query) => {
      if (!query) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'query',
            message: 'What do you need help with?'
          }
        ]);
        query = response.query;
      }
      
      assist(query);
    });
}

if (compile) {
  // Compile command
  program
    .command('compile')
    .description('Compile your smart contracts')
    .action(() => {
      compile();
    });
}

if (test) {
  // Test command
  program
    .command('test')
    .description('Run tests for your project')
    .action(() => {
      test();
    });
}

if (config) {
  // Config command
  program
    .command('config')
    .description('Configure your ARVIL settings')
    .action(() => {
      config();
    });
}

// Parse arguments
program.parse(process.argv);

// If no arguments, display help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 