const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const LLMProvider = require('../utils/llm');
const GitManager = require('../utils/git');
const { isInProject, getProjectInfo } = require('../utils/project');
const ora = require('ora');
const inquirer = require('inquirer');

/**
 * Get AI assistance for a specific task
 * @param {string} query - The user's query
 */
async function assist(query) {
  try {
    // Check if we're in a project
    const inProject = isInProject();
    let projectInfo = null;
    if (inProject) {
      projectInfo = getProjectInfo();
      console.log(chalk.cyan(`Working in project: ${projectInfo.name} (${projectInfo.blockchain})`));
    } else {
      console.log(chalk.yellow('Warning: Not in an ARVIL project directory. Some features may not work properly.'));
      console.log(chalk.yellow('Tip: Run `arvil init my-project` to create a new project first.'));
    }

    // Initialize LLM provider
    const llm = new LLMProvider();
    
    // Initialize Git manager if in project
    let git = null;
    if (inProject) {
      git = new GitManager(process.cwd());
      await git.initialize();
    }

    // Prepare context for the AI
    const context = [];
    
    // Add project context if available
    if (projectInfo) {
      context.push({
        role: 'system',
        content: `You are assisting with a blockchain project:
- Project: ${projectInfo.name}
- Platform: ${projectInfo.blockchain}
- Network: ${projectInfo.network}
Please provide relevant advice and code examples for this context.`
      });
    }

    // Add the user's query
    context.push({
      role: 'user',
      content: query
    });

    // Get AI response
    const spinner = ora('Getting AI assistance...').start();
    const response = await llm.chat(context, {
      model: process.env.ARVIL_DEFAULT_MODEL || 'gpt-4',
      temperature: 0.7
    });
    spinner.succeed('Got AI response');

    // Process the response
    console.log('\n' + response + '\n');

    // Look for code blocks in the response
    const codeBlocks = response.match(/```[\s\S]*?```/g) || [];
    
    if (codeBlocks.length > 0 && inProject) {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'implement',
          message: 'Would you like me to implement these changes?',
          default: true
        }
      ]);

      if (answer.implement) {
        // Process each code block
        for (const block of codeBlocks) {
          const [filename, ...lines] = block
            .replace(/```[\w]*\n/, '')  // Remove opening ```
            .replace(/```$/, '')         // Remove closing ```
            .split('\n');
          
          if (filename && lines.length > 0) {
            const filePath = path.join(process.cwd(), filename.trim());
            await fs.ensureFile(filePath);
            await fs.writeFile(filePath, lines.join('\n'));
            console.log(chalk.green(`Created/updated ${filename.trim()}`));

            // Commit changes if Git is initialized
            if (git) {
              await git.commitChanges([filename.trim()], `AI: Implement changes from assist command`);
            }
          }
        }
      }
    }

  } catch (error) {
    if (error.message.includes('API key')) {
      console.error(chalk.red('Error: API key not set.'));
      console.log('Please set your API key by running:');
      console.log(chalk.cyan('  arvil config'));
    } else {
      console.error(chalk.red('Error:', error.message));
    }
    process.exit(1);
  }
}

module.exports = assist; 