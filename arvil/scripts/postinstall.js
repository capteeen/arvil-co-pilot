#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Check if this is a global installation
const isGlobalInstall = process.env.npm_config_global === 'true';

// Function to make CLI scripts executable
function makeExecutable(filePath) {
  try {
    // Only attempt to chmod on Unix-like systems
    if (process.platform !== 'win32') {
      fs.chmodSync(filePath, '755');
    }
  } catch (error) {
    // Just log the error but don't fail the installation
    console.error(`Warning: Could not make ${filePath} executable: ${error.message}`);
  }
}

// Display welcome message
console.log(chalk.cyan('╭──────────────────────────────────────────────────────────────╮'));
console.log(chalk.cyan('│                                                              │'));
console.log(chalk.cyan('│                 ARVIL - Blockchain AI Engineer               │'));
console.log(chalk.cyan('│                                                              │'));
console.log(chalk.cyan('╰──────────────────────────────────────────────────────────────╯'));

console.log(chalk.green('\nThanks for installing ARVIL! 🚀'));

// Make CLI entry points executable
const cliPath = path.join(__dirname, '..', 'src', 'cli.js');
const indexPath = path.join(__dirname, '..', 'src', 'index.js');

if (fs.existsSync(cliPath)) {
  makeExecutable(cliPath);
}

if (fs.existsSync(indexPath)) {
  makeExecutable(indexPath);
}

// Show installation type and next steps
if (isGlobalInstall) {
  console.log(chalk.green('\nARVIL has been installed globally! 🌎'));
  console.log('\nTo get started:');
  console.log(chalk.cyan('  arvil config     ') + '# Set up your API keys');
  console.log(chalk.cyan('  arvil init       ') + '# Create a new blockchain project');
  console.log(chalk.cyan('  arvil assist     ') + '# Get AI assistance');
} else {
  console.log(chalk.yellow('\nARVIL has been installed locally in this project. '));
  console.log(chalk.yellow('For global installation, run: npm install -g arvil-cli'));
  
  console.log('\nTo use ARVIL locally:');
  console.log(chalk.cyan('  npx arvil config     ') + '# Set up your API keys');
  console.log(chalk.cyan('  npx arvil init       ') + '# Create a new blockchain project');
  console.log(chalk.cyan('  npx arvil assist     ') + '# Get AI assistance');
}

console.log('\nFor more information, see:');
console.log(chalk.cyan('  https://github.com/yourusername/arvil#readme'));
console.log(chalk.cyan('  https://github.com/yourusername/arvil/blob/main/GETTING-STARTED.md'));

console.log('\n' + chalk.green('Installation complete! Happy blockchain coding! 🎉') + '\n'); 