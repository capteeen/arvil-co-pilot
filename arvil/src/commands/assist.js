const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { getProjectInfo, getCurrentProject, isInProject, updateProjectTimestamp } = require('../utils/project');

// Lazy load OpenAI to avoid startup errors
let openaiModule = null;
let openai = null;

// Track created files
const createdFiles = new Set();

// Auto-execution settings
const AUTO_EXECUTE = true; // Set to true to auto-execute without prompting

/**
 * Get AI assistance for a specific task
 * @param {string} query - The query to get assistance for
 */
async function assist(query) {
  // Check if in a project directory
  let projectInfo = null;
  let projectWarningShown = false;
  
  try {
    if (isInProject()) {
      projectInfo = getProjectInfo();
      console.log(chalk.green(`Working in project: ${projectInfo.name} (${projectInfo.type})`));
      
      // Update project timestamp to mark it as recently used
      updateProjectTimestamp(projectInfo.path);
    } else {
      console.log(chalk.yellow('Warning: Not in an ARVIL project directory. Some features may not work properly.'));
      console.log(chalk.yellow('Tip: Run `arvil init my-project` to create a new project first.'));
      projectWarningShown = true;
    }
  } catch (error) {
    // Silently continue if project detection fails
  }
  
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
        { role: "system", content: "You are ARVIL, an AI blockchain engineer assistant for Solana. You provide expert help with smart contract development, debugging, testing, and deployment. When providing code solutions, present them as executable commands (bash) and file snippets (with specific filenames) that should be implemented. Be concise, technical, and helpful." },
        { role: "user", content: `${context}${query}` }
      ],
      temperature: 0.5,
      max_tokens: 1500
    });
    
    // Extract and display the response
    const aiResponse = response.choices[0].message.content;
    spinner.succeed('Response generated');
    
    console.log('\n' + chalk.cyan('ARVIL: ') + aiResponse + '\n');
    
    // Extract code blocks and execute them
    const codeBlocks = extractCodeBlocks(aiResponse);
    
    if (codeBlocks.length > 0) {
      if (AUTO_EXECUTE) {
        // Automatically process code blocks without prompting
        await autoProcessCodeBlocks(codeBlocks, aiResponse, projectInfo);
      } else {
        // Use the interactive mode if AUTO_EXECUTE is false
        await handleCodeBlocks(codeBlocks, projectInfo);
      }
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
 * Automatically process code blocks without prompting
 * @param {Array} codeBlocks - Array of code blocks to process
 * @param {string} aiResponse - The full AI response text
 * @param {Object|null} projectInfo - Project information if in a project
 */
async function autoProcessCodeBlocks(codeBlocks, aiResponse, projectInfo = null) {
  // Track if any errors occurred during processing
  let errorsOccurred = false;
  let errorMessages = [];
  
  // First, scan for placeholders that need user input
  const placeholderValues = await detectAndPromptForPlaceholders(aiResponse, codeBlocks);
  
  // First, create all identified files from the codeblocks
  const fileBlocks = codeBlocks.filter(block => 
    !['bash', 'shell', 'sh', ''].includes(block.language));
  
  // Extract potential filenames from the response
  const filenameMatcher = /file[s]? (?:named|called) [`"]?([a-zA-Z0-9._\-/]+)[`"]?/gi;
  const createMatcher = /[Cc]reate (?:a|the) [`"]?([a-zA-Z0-9._\-/]+)[`"]? file/gi;
  
  // Extract filenames from the AI response text
  let filenameMatches = [];
  let match;
  
  while ((match = filenameMatcher.exec(aiResponse)) !== null) {
    filenameMatches.push(match[1]);
  }
  
  while ((match = createMatcher.exec(aiResponse)) !== null) {
    filenameMatches.push(match[1]);
  }
  
  // Create files with detected filenames
  if (fileBlocks.length > 0) {
    console.log(chalk.cyan('\nCreating files automatically:'));
    
    for (let i = 0; i < fileBlocks.length; i++) {
      const block = fileBlocks[i];
      
      // Determine filename based on language if not explicitly mentioned
      let filename = '';
      
      // First, check if a filename was mentioned in the text
      if (i < filenameMatches.length) {
        filename = filenameMatches[i];
      } else {
        // Fallback to language-based naming
        switch (block.language) {
          case 'javascript':
          case 'js':
            filename = `script${i+1}.js`;
            break;
          case 'typescript':
          case 'ts':
            filename = `script${i+1}.ts`;
            break;
          case 'rust':
          case 'rs':
            filename = `program${i+1}.rs`;
            break;
          case 'solidity':
          case 'sol':
            filename = `contract${i+1}.sol`;
            break;
          case 'plaintext':
            if (block.code.startsWith('PRIVATE_KEY=') || block.code.includes('=')) {
              filename = '.env';
            } else {
              filename = `file${i+1}.txt`;
            }
            break;
          default:
            filename = `file${i+1}.${block.language || 'txt'}`;
        }
      }
      
      // Add path awareness - ensure files are created in the right location
      // If we're in a project, make sure paths are relative to the project
      if (projectInfo && !filename.startsWith('/')) {
        // If the path is not absolute, make it relative to the project
        if (!path.isAbsolute(filename)) {
          // Check if we're trying to create a file outside the current dir
          if (filename.startsWith('..')) {
            console.log(chalk.yellow(`Warning: Attempting to create file outside current directory: ${filename}`));
            console.log(chalk.yellow(`Creating in current directory instead.`));
            filename = path.basename(filename);
          }
          
          // If we're not in the project root, adjust the path
          if (process.cwd() !== projectInfo.path) {
            const relativeToProject = path.relative(projectInfo.path, process.cwd());
            // Only prepend if we're in a subdirectory of the project
            if (!relativeToProject.startsWith('..')) {
              filename = path.join(relativeToProject, filename);
            }
          }
        }
      }
      
      // Replace placeholders in the code with user-provided values
      let codeWithReplacements = replacePlaceholders(block.code, placeholderValues);
      
      try {
        await createFile(filename, codeWithReplacements);
      } catch (error) {
        errorsOccurred = true;
        errorMessages.push(`Error creating file ${filename}: ${error.message}`);
      }
    }
  }
  
  // Then execute terminal commands
  const commandBlocks = codeBlocks.filter(block => 
    ['bash', 'shell', 'sh', ''].includes(block.language));
  
  if (commandBlocks.length > 0) {
    console.log(chalk.cyan('\nExecuting commands automatically:'));
    
    for (const block of commandBlocks) {
      // Skip commands that might be unsafe or are just examples
      if (block.code.includes('sudo ') || 
          block.code.includes('rm -rf')) {
        console.log(chalk.yellow(`Skipping potentially unsafe command: ${block.code.substring(0, 50)}...`));
        continue;
      }
      
      // Replace placeholders with user input
      const commandWithReplacements = replacePlaceholders(block.code, placeholderValues);
      
      // Skip example commands that haven't been properly filled in
      if (commandWithReplacements.includes('[YourPrivateKey') || 
          commandWithReplacements.includes('your_actual_private_key_here')) {
        console.log(chalk.yellow(`Skipping example command: ${commandWithReplacements.substring(0, 50)}...`));
        continue;
      }
      
      const result = await executeCommand(commandWithReplacements);
      if (!result.success) {
        errorsOccurred = true;
        errorMessages.push(`Command failed: ${commandWithReplacements}`);
      }
    }
  }
  
  // If errors occurred during processing, attempt to resolve them
  if (errorsOccurred) {
    console.log(chalk.yellow('\nErrors occurred during execution. Attempting to resolve...'));
    for (const errorMsg of errorMessages) {
      console.log(chalk.red(`- ${errorMsg}`));
    }
    
    // Use AI to suggest fixes for the errors
    await attemptErrorResolution('auto-process', errorMessages.join('\n'));
  }
}

/**
 * Detect placeholders in the AI response and prompt the user for values
 * @param {string} aiResponse - The full AI response
 * @param {Array} codeBlocks - The extracted code blocks
 * @returns {Object} - A map of placeholders to their user-provided values
 */
async function detectAndPromptForPlaceholders(aiResponse, codeBlocks) {
  const placeholderValues = {};
  
  // Compile all code into a single string for easier pattern matching
  const allCode = codeBlocks.map(block => block.code).join('\n');
  
  // Common patterns for placeholders that need user input
  const patterns = [
    // Private keys
    { regex: /\[YourPrivateKey(?:Array)?\]/, 
      type: 'private_key', 
      message: 'Enter your Solana private key (array of bytes):',
      validation: (input) => input.trim().length > 0
    },
    { regex: /['"]your_(?:actual_)?private_key(?:_array)?_here['"]/, 
      type: 'private_key', 
      message: 'Enter your Solana private key:',
      validation: (input) => input.trim().length > 0 
    },
    
    // API keys
    { regex: /\[YourAPIKey\]/, 
      type: 'api_key', 
      message: 'Enter your API key:',
      validation: (input) => input.trim().length > 0 
    },
    { regex: /['"]your_api_key(?:_here)?['"]/, 
      type: 'api_key', 
      message: 'Enter your API key:',
      validation: (input) => input.trim().length > 0 
    },
    
    // Wallet addresses
    { regex: /\[YourWalletAddress\]/, 
      type: 'wallet_address', 
      message: 'Enter your wallet address:',
      validation: (input) => input.trim().length > 0 
    },
    { regex: /['"]your_wallet_address(?:_here)?['"]/, 
      type: 'wallet_address', 
      message: 'Enter your wallet address:',
      validation: (input) => input.trim().length > 0 
    },
    
    // RPC endpoints
    { regex: /\[YourRPCEndpoint\]/, 
      type: 'rpc_endpoint', 
      message: 'Enter your RPC endpoint URL:',
      validation: (input) => input.trim().length > 0 && input.startsWith('http')
    },
    { regex: /['"]your_rpc_endpoint(?:_here)?['"]/, 
      type: 'rpc_endpoint', 
      message: 'Enter your RPC endpoint URL:',
      validation: (input) => input.trim().length > 0 && input.startsWith('http') 
    },
  ];
  
  // Check for each pattern in the code
  for (const pattern of patterns) {
    if (pattern.regex.test(allCode) || pattern.regex.test(aiResponse)) {
      // Only prompt for each type once
      if (!placeholderValues[pattern.type]) {
        const { value } = await inquirer.prompt([
          {
            type: pattern.type === 'private_key' ? 'password' : 'input',
            name: 'value',
            message: pattern.message,
            validate: pattern.validation
          }
        ]);
        
        placeholderValues[pattern.type] = value;
        
        // Store private key in .env file for future use
        if (pattern.type === 'private_key') {
          await updateEnvFile('PRIVATE_KEY', value);
          console.log(chalk.green('✓ Saved private key to .env file'));
        }
        
        // Store API key in .env file
        if (pattern.type === 'api_key') {
          await updateEnvFile('API_KEY', value);
          console.log(chalk.green('✓ Saved API key to .env file'));
        }
        
        // Store wallet address
        if (pattern.type === 'wallet_address') {
          await updateEnvFile('WALLET_ADDRESS', value);
          console.log(chalk.green('✓ Saved wallet address to .env file'));
        }
        
        // Store RPC endpoint
        if (pattern.type === 'rpc_endpoint') {
          await updateEnvFile('RPC_ENDPOINT', value);
          console.log(chalk.green('✓ Saved RPC endpoint to .env file'));
        }
      }
    }
  }
  
  return placeholderValues;
}

/**
 * Update or create .env file with a key-value pair
 * @param {string} key - The env variable name
 * @param {string} value - The value to set
 */
async function updateEnvFile(key, value) {
  const envPath = '.env';
  let envContent = '';
  
  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Check if the key already exists
  const keyRegex = new RegExp(`^${key}=.*$`, 'm');
  
  if (keyRegex.test(envContent)) {
    // Update existing key
    envContent = envContent.replace(keyRegex, `${key}=${value}`);
  } else {
    // Add new key
    envContent += `\n${key}=${value}`;
  }
  
  // Write updated content back to .env file
  fs.writeFileSync(envPath, envContent.trim(), 'utf8');
}

/**
 * Replace placeholder patterns in code with user-provided values
 * @param {string} code - The code block to process
 * @param {Object} placeholderValues - Map of placeholders to values
 * @returns {string} - Code with replacements
 */
function replacePlaceholders(code, placeholderValues) {
  let result = code;
  
  // Replace private key placeholders
  if (placeholderValues.private_key) {
    result = result.replace(/\[YourPrivateKey(?:Array)?\]/g, placeholderValues.private_key);
    result = result.replace(/['"]your_(?:actual_)?private_key(?:_array)?_here['"]/g, `"${placeholderValues.private_key}"`);
    result = result.replace(/PRIVATE_KEY=.*$/m, `PRIVATE_KEY=${placeholderValues.private_key}`);
  }
  
  // Replace API key placeholders
  if (placeholderValues.api_key) {
    result = result.replace(/\[YourAPIKey\]/g, placeholderValues.api_key);
    result = result.replace(/['"]your_api_key(?:_here)?['"]/g, `"${placeholderValues.api_key}"`);
    result = result.replace(/API_KEY=.*$/m, `API_KEY=${placeholderValues.api_key}`);
  }
  
  // Replace wallet address placeholders
  if (placeholderValues.wallet_address) {
    result = result.replace(/\[YourWalletAddress\]/g, placeholderValues.wallet_address);
    result = result.replace(/['"]your_wallet_address(?:_here)?['"]/g, `"${placeholderValues.wallet_address}"`);
    result = result.replace(/WALLET_ADDRESS=.*$/m, `WALLET_ADDRESS=${placeholderValues.wallet_address}`);
  }
  
  // Replace RPC endpoint placeholders
  if (placeholderValues.rpc_endpoint) {
    result = result.replace(/\[YourRPCEndpoint\]/g, placeholderValues.rpc_endpoint);
    result = result.replace(/['"]your_rpc_endpoint(?:_here)?['"]/g, `"${placeholderValues.rpc_endpoint}"`);
    result = result.replace(/RPC_ENDPOINT=.*$/m, `RPC_ENDPOINT=${placeholderValues.rpc_endpoint}`);
  }
  
  return result;
}

/**
 * Create a file with the given name and content
 * @param {string} filename - The name of the file to create
 * @param {string} content - The content to write to the file
 */
async function createFile(filename, content) {
  try {
    // Create containing directories if they don't exist
    const dirname = path.dirname(filename);
    if (dirname !== '.') {
      fs.mkdirpSync(dirname);
    }
    
    // Write the file
    fs.writeFileSync(filename, content);
    console.log(chalk.green(`✓ Created file: ${filename}`));
    
    // Add to tracked files
    createdFiles.add(filename);
    
    // Make executable if it's a script
    if (filename.endsWith('.sh') || filename.endsWith('.js')) {
      fs.chmodSync(filename, '755');
      console.log(chalk.green(`  Made ${filename} executable`));
    }
  } catch (error) {
    console.error(chalk.red(`Error creating file: ${error.message}`));
  }
}

/**
 * Execute a command in the terminal
 * @param {string} command - The command to execute
 */
async function executeCommand(command) {
  console.log(chalk.cyan(`$ ${command}`));
  const spinner = ora('Running command').start();
  
  try {
    const { stdout, stderr } = await execAsync(command);
    spinner.succeed('Command executed');
    
    if (stdout) {
      console.log(chalk.green('\nOutput:'));
      console.log(stdout);
    }
    
    if (stderr) {
      console.log(chalk.yellow('\nWarnings/Errors:'));
      console.log(stderr);
      
      // Check if error is serious enough to attempt resolution
      if (stderr.includes('Error:') || stderr.includes('error:') || stderr.includes('fatal:')) {
        await attemptErrorResolution(command, stderr);
      }
    }
    
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    spinner.fail('Command failed');
    console.error(chalk.red(`Error: ${error.message}`));
    
    // Attempt to resolve the error
    await attemptErrorResolution(command, error.message);
    
    return { success: false, error: error.message };
  }
}

/**
 * Attempt to automatically resolve an error
 * @param {string} failedCommand - The command that failed
 * @param {string} errorMessage - The error message
 */
async function attemptErrorResolution(failedCommand, errorMessage) {
  console.log(chalk.cyan('\nAttempting to fix the error automatically...'));
  
  // Prepare the context for the AI
  const context = {
    command: failedCommand,
    error: errorMessage,
    // Add current directory and environment
    currentDir: process.cwd()
  };
  
  // Send request to OpenAI for error resolution
  try {
    if (!openai) {
      if (!openaiModule) {
        const { OpenAI } = require('openai');
        openaiModule = OpenAI;
      }
      openai = new openaiModule({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    const spinner = ora('Analyzing error...').start();
    
    // Generate a solution for the error
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an expert error resolver for command-line operations and code. Analyze errors and provide practical, immediate solutions. Output code blocks or commands that should be executed to fix the problem. Be direct and concise. Focus on common development errors including package installation issues, configuration problems, missing dependencies, syntax errors, etc. Provide solutions that can be automatically executed."
        },
        { 
          role: "user", 
          content: `I encountered an error while executing this command: "${failedCommand}"\n\nError message:\n${errorMessage}\n\nCurrent directory: ${context.currentDir}\n\nPlease provide a solution that can be automatically applied.` 
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });
    
    const solution = response.choices[0].message.content;
    spinner.succeed('Solution found');
    
    console.log(chalk.cyan('\nProposed solution:'));
    console.log(solution);
    
    // Extract code blocks or commands
    const fixCodeBlocks = extractCodeBlocks(solution);
    
    if (fixCodeBlocks.length > 0) {
      console.log(chalk.cyan('\nApplying fixes automatically...'));
      
      // Automatically apply fixes
      await autoProcessCodeBlocks(fixCodeBlocks, solution);
      
      // If we originally failed on installing dependencies, try again
      if (failedCommand.includes('npm install') || failedCommand.includes('yarn add')) {
        console.log(chalk.cyan('\nRetrying original installation command...'));
        await executeCommand(failedCommand);
      }
    } else {
      console.log(chalk.yellow('\nNo specific commands or files to fix were found in the solution.'));
    }
    
  } catch (error) {
    console.error(chalk.red(`Error while attempting resolution: ${error.message}`));
  }
}

/**
 * Handle extracted code blocks (interactive mode)
 * @param {Array} codeBlocks - Array of code blocks to handle
 * @param {Object|null} projectInfo - Project information if in a project
 */
async function handleCodeBlocks(codeBlocks, projectInfo = null) {
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
  await executeCommand(selectedCommand);
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
  
  await createFile(filename, fileBlocks[fileIndex].code);
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