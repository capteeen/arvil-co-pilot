const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { OpenAI } = require('openai');
const { isProjectDirectory, getProjectInfo } = require('../utils/project');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get blockchain AI assistance
 * @param {string} query - User's query or request
 */
async function assist(query) {
  // Check if OPENAI_API_KEY is set
  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.red('Error: OPENAI_API_KEY is not set.'));
    console.log(chalk.yellow('Please run `arvil config` to set up your API key.'));
    return;
  }

  // Check if we're in a project directory
  if (!isProjectDirectory()) {
    console.log(chalk.yellow('Warning: Not in an ARVIL project directory.'));
    console.log(chalk.yellow('Some context-specific features may not work properly.'));
  }

  const spinner = ora('Thinking...').start();
  
  try {
    // Get project information if available
    let projectInfo = null;
    try {
      projectInfo = getProjectInfo();
    } catch (error) {
      // Not in a project directory, continue without project context
    }

    // Build the prompt based on the query and project context
    const systemPrompt = buildSystemPrompt(projectInfo);
    const userPrompt = query;

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    spinner.stop();

    // Display the assistant's response
    const assistantResponse = response.choices[0].message.content;
    
    console.log(chalk.cyan('\n╭─────── ARVIL Assistant ───────╮'));
    console.log(chalk.white(assistantResponse));
    console.log(chalk.cyan('╰────────────────────────────────╯\n'));
    
    // Ask if the user wants to implement the solution
    if (projectInfo) {
      const { implement } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'implement',
          message: 'Would you like me to implement this solution for you?',
          default: false
        }
      ]);
      
      if (implement) {
        await implementSolution(query, assistantResponse, projectInfo);
      }
    }

  } catch (error) {
    spinner.fail('Failed to get assistance');
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Build system prompt based on project context
 * @param {Object} projectInfo - Information about the current project
 * @returns {string} - The system prompt
 */
function buildSystemPrompt(projectInfo) {
  let prompt = `You are ARVIL, an Advanced Robust Virtual Innovation Lab assistant specialized in blockchain development, particularly Solana. 
You provide concise, accurate, and helpful responses to blockchain development queries.

When answering:
1. Be specific and provide code examples when appropriate
2. Focus on best practices for blockchain development
3. Suggest secure implementation patterns
4. Explain complex concepts clearly and concisely

`;

  if (projectInfo) {
    prompt += `\nCurrent project context:
- Project name: ${projectInfo.name}
- Project structure: ${JSON.stringify(projectInfo.structure)}
- Dependencies: ${JSON.stringify(projectInfo.dependencies)}
`;
  }

  return prompt;
}

/**
 * Implement the solution suggested by the AI
 * @param {string} query - Original user query
 * @param {string} solution - AI-suggested solution
 * @param {Object} projectInfo - Project information
 */
async function implementSolution(query, solution, projectInfo) {
  const spinner = ora('Implementing solution...').start();
  
  try {
    // Extract code blocks from the AI response
    const codeBlocks = extractCodeBlocks(solution);
    
    if (codeBlocks.length === 0) {
      spinner.fail('No code blocks found in the solution');
      return;
    }
    
    // Ask which code block to implement if multiple are found
    let selectedBlock = 0;
    if (codeBlocks.length > 1) {
      spinner.stop();
      
      const { blockIndex } = await inquirer.prompt([
        {
          type: 'list',
          name: 'blockIndex',
          message: 'Multiple code blocks found. Which one would you like to implement?',
          choices: codeBlocks.map((block, index) => ({
            name: `Block ${index + 1}: ${block.language} (${block.code.split('\n').length} lines)`,
            value: index
          }))
        }
      ]);
      
      selectedBlock = blockIndex;
      spinner.start('Implementing solution...');
    }
    
    const block = codeBlocks[selectedBlock];
    
    // Determine file path
    let filePath;
    spinner.stop();
    
    const { customPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customPath',
        message: 'Enter the file path to save this code (relative to project root):',
        default: getDefaultPath(block.language, query)
      }
    ]);
    
    filePath = path.join(process.cwd(), customPath);
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'File already exists. Do you want to overwrite it?',
          default: false
        }
      ]);
      
      if (!overwrite) {
        console.log(chalk.yellow('Implementation aborted.'));
        return;
      }
    }
    
    // Ensure directory exists
    fs.ensureDirSync(path.dirname(filePath));
    
    // Write the code to the file
    fs.writeFileSync(filePath, block.code);
    
    spinner.succeed(`Solution implemented at ${chalk.cyan(customPath)}`);
  } catch (error) {
    spinner.fail('Failed to implement solution');
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Extract code blocks from a markdown string
 * @param {string} markdown - Markdown string
 * @returns {Array} - Array of code blocks with language and code
 */
function extractCodeBlocks(markdown) {
  const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2]
    });
  }
  
  return blocks;
}

/**
 * Get default file path based on language and query
 * @param {string} language - Programming language
 * @param {string} query - User query
 * @returns {string} - Default file path
 */
function getDefaultPath(language, query) {
  // Extract potential filename from query
  const words = query.split(' ');
  let filename = '';
  
  for (const word of words) {
    if (word.endsWith('.js') || word.endsWith('.rs') || word.endsWith('.ts') || word.endsWith('.sol')) {
      filename = word;
      break;
    }
  }
  
  if (!filename) {
    // Generate filename based on language
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
        filename = 'script.js';
        break;
      case 'typescript':
      case 'ts':
        filename = 'script.ts';
        break;
      case 'rust':
      case 'rs':
        filename = 'program.rs';
        break;
      case 'solidity':
      case 'sol':
        filename = 'contract.sol';
        break;
      default:
        filename = 'code.txt';
    }
  }
  
  return `src/${filename}`;
}

module.exports = assist; 