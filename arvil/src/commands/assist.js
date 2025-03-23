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
  
  // Track attempted solutions to avoid loops
  const attemptedSolutions = new Set();
  
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
          content: "You are an expert error resolver for command-line operations and code. Analyze errors and provide practical, immediate solutions. Output code blocks or commands that should be executed to fix the problem. Be direct and concise. Focus on common development errors including package installation issues, configuration problems, missing dependencies, syntax errors, etc. Provide solutions that can be automatically executed. When providing shell commands, ensure they will work in a single execution - avoid requiring user input unless absolutely necessary. If a command requires input, consider providing it via arguments or environment variables. IMPORTANT: If the error involves conflicting configuration formats (like ESLint config files), choose ONE definitive solution and stick with it rather than trying both approaches."
        },
        { 
          role: "user", 
          content: `I encountered an error while executing this command: "${failedCommand}"\n\nError message:\n${errorMessage}\n\nCurrent directory: ${context.currentDir}\n\nPlease provide a single definitive solution that can be automatically applied.` 
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
      // Hash the solution to avoid applying the same fix repeatedly
      const solutionHash = JSON.stringify(fixCodeBlocks.map(block => block.code));
      
      if (attemptedSolutions.has(solutionHash)) {
        console.log(chalk.yellow('\nThis solution has already been attempted. Trying a different approach...'));
        
        // Try a more direct approach for common problems
        await handleCommonErrors(failedCommand, errorMessage);
        return;
      }
      
      // Mark this solution as attempted
      attemptedSolutions.add(solutionHash);
      
      console.log(chalk.cyan('\nApplying fix automatically...'));
      
      // Process only one code block at a time for better control
      const executionPromises = [];
      
      for (const block of fixCodeBlocks) {
        if (['bash', 'shell', 'sh', ''].includes(block.language)) {
          // For shell commands, execute one by one
          const commandLines = block.code
            .split('\n')
            .filter(line => line.trim() && !line.trim().startsWith('#'));
          
          for (const command of commandLines) {
            // Skip potentially unsafe commands
            if (command.includes('sudo ') || command.includes('rm -rf')) {
              console.log(chalk.yellow(`Skipping potentially unsafe command: ${command}`));
              continue;
            }
            
            console.log(chalk.cyan(`Executing: ${command}`));
            const result = await executeCommand(command);
            
            // If this command succeeded, break out of the loop
            if (result.success && 
                (command.includes(failedCommand) || 
                 result.output.includes("0 vulnerabilities") || 
                 !result.error)) {
              console.log(chalk.green('✓ Fix successfully applied!'));
              return;
            }
          }
        } else {
          // For file content, try to determine the target file from the solution text
          const fileMatch = solution.match(/create|modify|update|fix (?:the )?(?:file )?[`'"]?([^`'"\s]+\.[a-zA-Z]+)[`'"]?/i);
          if (fileMatch) {
            const filename = fileMatch[1];
            await createFile(filename, block.code);
            console.log(chalk.green(`✓ Created/updated file: ${filename}`));
          }
        }
      }
      
      // If we got here, direct command execution didn't fully solve the issue
      // Let's try a more targeted approach for common errors
      if (errorMessage.includes('ESLint')) {
        await handleEslintErrors(errorMessage);
      } else if (errorMessage.includes('npm ERR!')) {
        await handleNpmErrors(errorMessage);
      }
    } else {
      console.log(chalk.yellow('\nNo specific commands or files to fix were found in the solution.'));
      
      // Try to address common errors directly
      await handleCommonErrors(failedCommand, errorMessage);
    }
    
  } catch (error) {
    console.error(chalk.red(`Error while attempting resolution: ${error.message}`));
    
    // Provide fallback for common errors even if AI fails
    await handleCommonErrors(failedCommand, errorMessage);
  }
}

/**
 * Handle common types of errors with direct solutions
 * @param {string} failedCommand - The command that failed
 * @param {string} errorMessage - The error message
 */
async function handleCommonErrors(failedCommand, errorMessage) {
  // ESLint configuration issues
  if (errorMessage.includes("ESLint") && errorMessage.includes("eslint.config")) {
    await handleEslintErrors(errorMessage);
    return;
  }
  
  // npm dependency issues
  if (errorMessage.includes("npm ERR!") || failedCommand.includes("npm install")) {
    await handleNpmErrors(errorMessage);
    return;
  }
  
  // File not found or permission issues
  if (errorMessage.includes("ENOENT") || errorMessage.includes("permission denied")) {
    await handleFileErrors(failedCommand, errorMessage);
    return;
  }
  
  console.log(chalk.yellow("Could not automatically resolve this error. Please check the error message and try to resolve it manually."));
}

/**
 * Handle ESLint specific errors
 * @param {string} errorMessage - The error message
 */
async function handleEslintErrors(errorMessage) {
  console.log(chalk.cyan("Fixing ESLint configuration issues..."));
  
  // Determine current directory
  const currentDir = process.cwd();
  
  // ESLint v9 uses eslint.config.js, previous versions use .eslintrc.*
  if (errorMessage.includes("ESLint couldn't find an eslint.config")) {
    // Check if .eslintrc.* exists
    const eslintrcExists = fs.existsSync(path.join(currentDir, '.eslintrc.js')) || 
                          fs.existsSync(path.join(currentDir, '.eslintrc.json')) || 
                          fs.existsSync(path.join(currentDir, '.eslintrc'));
    
    if (eslintrcExists) {
      // Convert .eslintrc.* to eslint.config.js
      console.log(chalk.cyan("Converting .eslintrc.* to eslint.config.js format..."));
      
      // Find which .eslintrc file exists
      let oldConfigFile = '';
      if (fs.existsSync(path.join(currentDir, '.eslintrc.js'))) {
        oldConfigFile = '.eslintrc.js';
      } else if (fs.existsSync(path.join(currentDir, '.eslintrc.json'))) {
        oldConfigFile = '.eslintrc.json';
      } else if (fs.existsSync(path.join(currentDir, '.eslintrc'))) {
        oldConfigFile = '.eslintrc';
      }
      
      // Create minimal eslint.config.js
      const configContent = `export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**'],
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Basic rules
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
];`;
      
      // Write new config file
      fs.writeFileSync(path.join(currentDir, 'eslint.config.js'), configContent);
      console.log(chalk.green("✓ Created eslint.config.js with basic rules"));
      
      // Add type:module to package.json if it doesn't exist
      try {
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          if (!packageJson.type) {
            packageJson.type = 'module';
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            console.log(chalk.green("✓ Added type:module to package.json"));
          }
        }
      } catch (error) {
        console.log(chalk.yellow(`Warning: Could not update package.json: ${error.message}`));
      }
    } else {
      // Create new eslint.config.js
      const configContent = `export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**'],
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Basic rules
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
];`;
      
      fs.writeFileSync(path.join(currentDir, 'eslint.config.js'), configContent);
      console.log(chalk.green("✓ Created eslint.config.js with basic rules"));
      
      // Add type:module to package.json
      try {
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          if (!packageJson.type) {
            packageJson.type = 'module';
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            console.log(chalk.green("✓ Added type:module to package.json"));
          }
        }
      } catch (error) {
        console.log(chalk.yellow(`Warning: Could not update package.json: ${error.message}`));
      }
    }
  }
  
  // Ensure ESLint is installed
  await executeCommand('npm install eslint --save-dev');
  
  console.log(chalk.green("ESLint configuration has been fixed."));
}

/**
 * Handle npm specific errors
 * @param {string} errorMessage - The error message
 */
async function handleNpmErrors(errorMessage) {
  console.log(chalk.cyan("Fixing npm dependency issues..."));
  
  // Check for specific npm errors
  if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
    // Permission issues
    console.log(chalk.cyan("Fixing npm permissions..."));
    await executeCommand('mkdir -p ~/.npm-global');
    await executeCommand('npm config set prefix ~/.npm-global');
    await executeCommand('npm install');
  } else if (errorMessage.includes('ENOENT') && errorMessage.includes('package.json')) {
    // Missing package.json
    console.log(chalk.cyan("Creating basic package.json..."));
    await executeCommand('npm init -y');
  } else if (errorMessage.includes('Cannot find module')) {
    // Missing dependency
    const moduleMatch = errorMessage.match(/Cannot find module '([^']+)'/);
    if (moduleMatch) {
      const moduleName = moduleMatch[1];
      console.log(chalk.cyan(`Installing missing module: ${moduleName}`));
      await executeCommand(`npm install ${moduleName} --save`);
    }
  } else {
    // General npm fix - clear cache and reinstall
    console.log(chalk.cyan("Fixing npm with cache clear and reinstall..."));
    await executeCommand('npm cache clean --force');
    await executeCommand('npm install');
  }
  
  console.log(chalk.green("npm issues have been addressed."));
}

/**
 * Handle file-related errors
 * @param {string} failedCommand - The command that failed
 * @param {string} errorMessage - The error message
 */
async function handleFileErrors(failedCommand, errorMessage) {
  console.log(chalk.cyan("Fixing file-related issues..."));
  
  // Check for file not found errors
  const fileMatch = errorMessage.match(/ENOENT: no such file or directory[^']*'([^']+)'/);
  if (fileMatch) {
    const filePath = fileMatch[1];
    const dirname = path.dirname(filePath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dirname)) {
      console.log(chalk.cyan(`Creating directory: ${dirname}`));
      fs.mkdirSync(dirname, { recursive: true });
    }
    
    // Create an empty file if it was supposed to be a file
    if (path.extname(filePath)) {
      console.log(chalk.cyan(`Creating empty file: ${filePath}`));
      fs.writeFileSync(filePath, '');
    }
  }
  
  console.log(chalk.green("File issues have been addressed."));
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