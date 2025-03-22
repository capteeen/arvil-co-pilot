const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { getProjectInfo } = require('../utils/project');

// Lazy load OpenAI to avoid startup errors
let openaiModule = null;
let openai = null;

// Track created files
const createdFiles = new Set();

/**
 * Get AI assistance for a specific task
 * @param {string} query - The query to get assistance for
 */
async function assist(query) {
  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.red('Error: OPENAI_API_KEY is not set.'));
    console.log(chalk.yellow('Please set your OpenAI API key by running:'));
    console.log(chalk.cyan('  arvil config'));
    return;
  }
  
  // Lazy load OpenAI now that we know we need it
  try {
    if (!openaiModule) {
      const { OpenAI } = require('openai');
      openaiModule = OpenAI;
    }
    
    if (!openai) {
      openai = new openaiModule({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  } catch (error) {
    console.log(chalk.red(`Error initializing OpenAI: ${error.message}`));
    console.log(chalk.yellow('Please check your internet connection and try again.'));
    return;
  }
  
  // Rest of your function here...
  const spinner = ora('Generating AI response...').start();
  
  try {
    // Get project info for context
    let projectInfo = null;
    try {
      projectInfo = getProjectInfo();
    } catch (error) {
      // Continue without project info
    }
    
    // Prepare context for the AI
    let context = '';
    if (projectInfo) {
      context = `The current project is ${projectInfo.name} (${projectInfo.description}). `;
      
      // Add dependencies info
      const deps = Object.keys(projectInfo.dependencies || {}).join(', ');
      if (deps) {
        context += `It uses the following dependencies: ${deps}. `;
      }
    }
    
    // Send request to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: "You are ARVIL, an AI blockchain engineer assistant for Solana. You provide expert help with smart contract development, debugging, testing, and deployment. When providing code solutions, present them as executable commands (bash) and file snippets (with filenames) that the user can immediately implement. Be concise, technical, and helpful." },
        { role: "user", content: `${context}${query}` }
      ],
      temperature: 0.5,
      max_tokens: 1500
    });
    
    // Extract and display the response
    const aiResponse = response.choices[0].message.content;
    spinner.succeed('Response generated');
    
    console.log('\n' + chalk.cyan('ARVIL: ') + aiResponse + '\n');
    
    // Extract code blocks and offer to execute them
    const codeBlocks = extractCodeBlocks(aiResponse);
    
    if (codeBlocks.length > 0) {
      await handleCodeBlocks(codeBlocks);
    }
    
  } catch (error) {
    spinner.fail('Failed to generate response');
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (error.message.includes('API key')) {
      console.log(chalk.yellow('Please check your OpenAI API key:'));
      console.log(chalk.cyan('  arvil config'));
    }
  }
}

/**
 * Extract code blocks from markdown text
 * @param {string} markdown - The markdown text
 * @returns {Array} - Array of code blocks with language and content
 */
function extractCodeBlocks(markdown) {
  const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const language = match[1].trim().toLowerCase();
    const code = match[2].trim();
    
    codeBlocks.push({
      language,
      code
    });
  }

  return codeBlocks;
}

/**
 * Handle extracted code blocks
 * @param {Array} codeBlocks - Array of code blocks to handle
 */
async function handleCodeBlocks(codeBlocks) {
  console.log(chalk.yellow('\nDetected code blocks in the response. Would you like to:'));
  console.log(chalk.cyan('1. Execute terminal commands'));
  console.log(chalk.cyan('2. Create files'));
  console.log(chalk.cyan('3. Show created files list'));
  console.log(chalk.cyan('4. Skip'));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Choose an action:',
      choices: [
        { name: 'Execute terminal commands', value: '1' },
        { name: 'Create files', value: '2' },
        { name: 'Show created files list', value: '3' },
        { name: 'Skip', value: '4' }
      ]
    }
  ]);
  
  switch (action) {
    case '1':
      await executeCommands(codeBlocks);
      break;
    case '2':
      await createFiles(codeBlocks);
      break;
    case '3':
      showCreatedFiles();
      break;
    default:
      console.log(chalk.yellow('No action taken.'));
  }
}

/**
 * Execute terminal commands from code blocks
 * @param {Array} codeBlocks - Array of code blocks to execute
 */
async function executeCommands(codeBlocks) {
  // Filter for bash/shell code blocks
  const commandBlocks = codeBlocks.filter(block => 
    ['bash', 'shell', 'sh', ''].includes(block.language));
  
  if (commandBlocks.length === 0) {
    console.log(chalk.yellow('No terminal commands found.'));
    return;
  }
  
  // Display available command blocks
  console.log(chalk.cyan('\nAvailable terminal commands:'));
  commandBlocks.forEach((block, index) => {
    console.log(chalk.cyan(`\n${index + 1}. Command:`));
    console.log(chalk.white(block.code));
  });
  
  // Ask which command to execute
  const { commandIndex } = await inquirer.prompt([
    {
      type: 'list',
      name: 'commandIndex',
      message: 'Which command would you like to execute?',
      choices: [
        ...commandBlocks.map((_, index) => ({ 
          name: `Command ${index + 1}`, 
          value: index 
        })),
        { name: 'Cancel', value: -1 }
      ]
    }
  ]);
  
  if (commandIndex === -1) {
    console.log(chalk.yellow('Command execution canceled.'));
    return;
  }
  
  const selectedCommand = commandBlocks[commandIndex].code;
  
  // Confirm execution
  const { confirmExecute } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmExecute',
      message: `Execute this command: "${selectedCommand}"?`,
      default: false
    }
  ]);
  
  if (!confirmExecute) {
    console.log(chalk.yellow('Command execution canceled.'));
    return;
  }
  
  // Execute the command
  console.log(chalk.cyan('\nExecuting command...'));
  const spinner = ora('Running command').start();
  
  try {
    const { stdout, stderr } = await execAsync(selectedCommand);
    spinner.succeed('Command executed');
    
    if (stdout) {
      console.log(chalk.green('\nOutput:'));
      console.log(stdout);
    }
    
    if (stderr) {
      console.log(chalk.yellow('\nWarnings/Errors:'));
      console.log(stderr);
    }
  } catch (error) {
    spinner.fail('Command failed');
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Create files from code blocks
 * @param {Array} codeBlocks - Array of code blocks to create files from
 */
async function createFiles(codeBlocks) {
  // Skip bash blocks that are likely commands, not file contents
  const fileBlocks = codeBlocks.filter(block => 
    !['bash', 'shell', 'sh'].includes(block.language));
  
  if (fileBlocks.length === 0) {
    console.log(chalk.yellow('No file content blocks found.'));
    return;
  }
  
  console.log(chalk.cyan('\nDetected possible file content:'));
  fileBlocks.forEach((block, index) => {
    console.log(chalk.cyan(`\n${index + 1}. ${block.language} code:`));
    console.log(chalk.white(block.code.slice(0, 100) + (block.code.length > 100 ? '...' : '')));
  });
  
  // Ask which block to save
  const { fileIndex } = await inquirer.prompt([
    {
      type: 'list',
      name: 'fileIndex',
      message: 'Which code block would you like to save to a file?',
      choices: [
        ...fileBlocks.map((block, index) => ({ 
          name: `${block.language} code block ${index + 1}`, 
          value: index 
        })),
        { name: 'Cancel', value: -1 }
      ]
    }
  ]);
  
  if (fileIndex === -1) {
    console.log(chalk.yellow('File creation canceled.'));
    return;
  }
  
  // Ask for filename
  const { filename } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filename',
      message: 'Enter filename:',
      validate: input => input.trim() ? true : 'Filename is required'
    }
  ]);
  
  // Create containing directories if they don't exist
  const dirname = path.dirname(filename);
  if (dirname !== '.') {
    fs.mkdirpSync(dirname);
  }
  
  // Write the file
  try {
    fs.writeFileSync(filename, fileBlocks[fileIndex].code);
    console.log(chalk.green(`\nFile created: ${filename}`));
    
    // Add to tracked files
    createdFiles.add(filename);
    
    // Make executable if it's a script
    if (filename.endsWith('.sh') || filename.endsWith('.js')) {
      fs.chmodSync(filename, '755');
      console.log(chalk.green(`Made ${filename} executable`));
    }
  } catch (error) {
    console.error(chalk.red(`Error creating file: ${error.message}`));
  }
}

/**
 * Display list of created files
 */
function showCreatedFiles() {
  if (createdFiles.size === 0) {
    console.log(chalk.yellow('\nNo files have been created yet.'));
    return;
  }
  
  console.log(chalk.cyan('\nFiles created this session:'));
  [...createdFiles].forEach(file => {
    console.log(chalk.green(`- ${file}`));
  });
}

module.exports = assist; 