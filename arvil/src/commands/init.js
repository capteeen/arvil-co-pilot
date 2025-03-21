const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');

/**
 * Initialize a new blockchain project
 * @param {string} projectName - Name of the project to create
 */
async function init(projectName) {
  const spinner = ora(`Creating a new blockchain project: ${projectName}`).start();
  
  try {
    // Create project directory
    const projectPath = path.resolve(process.cwd(), projectName);
    
    // Check if directory already exists
    if (fs.existsSync(projectPath)) {
      spinner.fail(`Project directory ${projectName} already exists`);
      
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Directory already exists. Do you want to overwrite it?',
          default: false
        }
      ]);
      
      if (!overwrite) {
        console.log(chalk.red('Project creation aborted.'));
        return;
      }
      
      fs.removeSync(projectPath);
    }
    
    fs.mkdirSync(projectPath);
    
    // Create project structure
    fs.mkdirSync(path.join(projectPath, 'src'));
    fs.mkdirSync(path.join(projectPath, 'tests'));
    fs.mkdirSync(path.join(projectPath, 'build'));
    
    // Copy templates
    const templatesDir = path.join(__dirname, '../templates');
    
    // Create package.json
    const packageJson = {
      name: projectName,
      version: '0.1.0',
      description: 'Blockchain project created with ARVIL',
      main: 'src/index.js',
      scripts: {
        start: 'node src/index.js',
        test: 'jest',
        build: 'arvil compile'
      },
      keywords: [
        'blockchain',
        'solana',
        'web3'
      ],
      author: '',
      license: 'MIT',
      dependencies: {
        '@solana/web3.js': '^1.78.0',
        '@solana/spl-token': '^0.3.7',
        'dotenv': '^16.3.1'
      },
      devDependencies: {
        'jest': '^29.5.0'
      }
    };
    
    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create .env file
    const envContent = `# Blockchain configuration
SOLANA_PRIVATE_KEY=
SOLANA_NETWORK=devnet

# API Keys
OPENAI_API_KEY=
`;
    
    fs.writeFileSync(path.join(projectPath, '.env'), envContent);
    
    // Create .gitignore
    const gitignoreContent = `node_modules
.env
build
dist
coverage
`;
    
    fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignoreContent);
    
    // Create README.md
    const readmeContent = `# ${projectName}

A blockchain project created with ARVIL.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run the application
npm start
\`\`\`

## Project Structure

- \`src/\` - Source code
- \`tests/\` - Test files
- \`build/\` - Compiled contracts

## Deployment

\`\`\`bash
# Deploy to Solana devnet
arvil deploy --network devnet
\`\`\`
`;
    
    fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent);
    
    // Create sample source file
    const indexContent = `// Main application entry point
console.log('Blockchain project initialized.');

// Your code here
`;
    
    fs.writeFileSync(path.join(projectPath, 'src/index.js'), indexContent);
    
    // Create sample smart contract
    const contractContent = `// Sample Solana program in Rust
/*
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
};

// Declare the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint implementation
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Hello, Solana!");
    Ok(())
}
*/

// This is a comment placeholder for a real Solana program
// Use 'arvil assist' for help creating a real smart contract
`;
    
    fs.writeFileSync(path.join(projectPath, 'src/program.rs'), contractContent);
    
    // Create sample test file
    const testContent = `// Sample test file
describe('Sample Test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
`;
    
    fs.writeFileSync(path.join(projectPath, 'tests/sample.test.js'), testContent);
    
    spinner.succeed(`Project ${projectName} created successfully!`);
    
    console.log('\n' + chalk.green('Next steps:'));
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan('  npm install'));
    console.log(chalk.cyan('  arvil assist "Create a token contract"'));
    
  } catch (error) {
    spinner.fail('Failed to create project');
    console.error(chalk.red(error));
  }
}

module.exports = init; 