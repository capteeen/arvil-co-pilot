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

// Import commands
const init = require('./commands/init');
const deploy = require('./commands/deploy');
const assist = require('./commands/assist');
const compile = require('./commands/compile');
const test = require('./commands/test');
const config = require('./commands/config');

// Check if OpenAI API key is set
const checkApiKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.yellow('Warning: OPENAI_API_KEY is not set. Some features may not work properly.'));
    console.log(chalk.yellow('Run `arvil config` to set up your API keys.'));
  }
};

// Display banner
console.log(
  chalk.cyan(
    figlet.textSync('ARVIL', { horizontalLayout: 'full' })
  )
);
console.log(chalk.cyan('Blockchain AI Engineer - v0.1.0\n'));

// Check API key
checkApiKey();

// Define CLI commands
program
  .version('0.1.0')
  .description('ARVIL - Blockchain AI Engineer Assistant');

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

// Deploy command
program
  .command('deploy')
  .description('Deploy your smart contract to the blockchain')
  .option('-n, --network <network>', 'Network to deploy to', 'devnet')
  .action((options) => {
    deploy(options);
  });

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

// Compile command
program
  .command('compile')
  .description('Compile your smart contracts')
  .action(() => {
    compile();
  });

// Test command
program
  .command('test')
  .description('Run tests for your project')
  .action(() => {
    test();
  });

// Config command
program
  .command('config')
  .description('Configure your ARVIL settings')
  .action(() => {
    config();
  });

// Parse arguments
program.parse(process.argv);

// If no arguments, display help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 