const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { isProjectDirectory } = require('../utils/project');

/**
 * Compile smart contracts
 */
async function compile() {
  // Check if we're in a project directory
  if (!isProjectDirectory()) {
    console.log(chalk.red('Error: Not in an ARVIL project directory.'));
    console.log(chalk.yellow('Please run this command from the root of an ARVIL project.'));
    return;
  }

  // Determine project type
  const projectType = detectProjectType();
  
  if (!projectType) {
    console.log(chalk.red('Error: Unable to determine project type.'));
    console.log(chalk.yellow('Make sure you have the necessary configuration files (Cargo.toml for Rust/Solana).'));
    return;
  }
  
  console.log(chalk.cyan(`Detected ${projectType} project`));
  
  // Compile based on project type
  switch (projectType) {
    case 'solana-rust':
      await compileRustSolana();
      break;
    case 'solana-js':
      await compileSolanaJs();
      break;
    default:
      console.log(chalk.red(`Error: Compiling ${projectType} projects is not yet supported.`));
  }
}

/**
 * Detect the type of blockchain project
 * @returns {string|null} - Project type or null if unknown
 */
function detectProjectType() {
  if (fs.existsSync('Cargo.toml')) {
    // Check if it's a Solana Rust project
    try {
      const cargoContent = fs.readFileSync('Cargo.toml', 'utf8');
      if (cargoContent.includes('solana-program')) {
        return 'solana-rust';
      }
    } catch (error) {
      // Ignore read errors
    }
  }
  
  // Check for Solana JavaScript projects
  if (fs.existsSync('package.json')) {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps['@solana/web3.js']) {
        return 'solana-js';
      }
    } catch (error) {
      // Ignore parse errors
    }
  }
  
  // No recognized project type
  return null;
}

/**
 * Compile a Rust Solana program
 */
async function compileRustSolana() {
  const spinner = ora('Compiling Rust Solana program...').start();

  try {
    // Check for Solana tools
    try {
      await execAsync('cargo --version');
    } catch (error) {
      spinner.fail('Rust is not installed');
      console.log(chalk.yellow('Please install Rust:'));
      console.log(chalk.cyan('  curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh'));
      return;
    }
    
    try {
      await execAsync('cargo build-bpf --help');
    } catch (error) {
      spinner.warn('Solana BPF tools not found, installing...');
      
      try {
        await execAsync('cargo install solana-program');
        
        spinner.succeed('Solana tools installed');
        spinner.text = 'Compiling Rust Solana program...';
        spinner.start();
      } catch (installError) {
        spinner.fail('Failed to install Solana tools');
        console.error(chalk.red(installError.message));
        console.log(chalk.yellow('Please install the Solana toolchain manually:'));
        console.log(chalk.cyan('  sh -c "$(curl -sSfL https://release.solana.com/v1.14.13/install)"'));
        return;
      }
    }
    
    // Compile the program
    spinner.text = 'Building BPF program...';
    const { stdout, stderr } = await execAsync('cargo build-bpf');
    
    if (stderr && stderr.includes('error:')) {
      spinner.fail('Compilation failed');
      console.error(chalk.red(stderr));
      return;
    }
    
    // Check for the compiled program
    const buildDir = 'target/deploy';
    
    if (!fs.existsSync(buildDir)) {
      spinner.fail('Build directory not found');
      return;
    }
    
    const files = fs.readdirSync(buildDir);
    let programFile = null;
    
    for (const file of files) {
      if (file.endsWith('.so')) {
        programFile = file;
        break;
      }
    }
    
    if (!programFile) {
      spinner.fail('No compiled program found');
      return;
    }
    
    spinner.succeed('Program compiled successfully');
    console.log(chalk.green(`\nCompiled program: ${chalk.cyan(`${buildDir}/${programFile}`)}`));
    console.log(chalk.green('\nTo deploy the program:'));
    console.log(chalk.cyan('  arvil deploy --network devnet'));
    
  } catch (error) {
    spinner.fail('Compilation failed');
    console.error(chalk.red(error.message));
  }
}

/**
 * Compile a Solana JavaScript project
 */
async function compileSolanaJs() {
  const spinner = ora('Building Solana JavaScript project...').start();
  
  try {
    // Check for npm/yarn
    try {
      await execAsync('npm --version');
    } catch (error) {
      spinner.fail('npm is not installed');
      console.log(chalk.yellow('Please install Node.js and npm:'));
      console.log(chalk.cyan('  https://nodejs.org/'));
      return;
    }
    
    // Check for package.json build script
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    if (!packageJson.scripts || !packageJson.scripts.build) {
      spinner.fail('No build script found in package.json');
      console.log(chalk.yellow('Please add a build script to your package.json:'));
      console.log(chalk.cyan('  "scripts": {\n    "build": "your-build-command"\n  }'));
      return;
    }
    
    // Run the build script
    spinner.text = 'Running build script...';
    const { stdout, stderr } = await execAsync('npm run build');
    
    if (stderr && stderr.includes('error')) {
      spinner.fail('Build failed');
      console.error(chalk.red(stderr));
      return;
    }
    
    spinner.succeed('Project built successfully');
    
    // Look for build artifacts
    const buildDirs = ['build', 'dist', 'out'];
    let buildDir = null;
    
    for (const dir of buildDirs) {
      if (fs.existsSync(dir)) {
        buildDir = dir;
        break;
      }
    }
    
    if (buildDir) {
      console.log(chalk.green(`\nBuild artifacts location: ${chalk.cyan(buildDir)}`));
    }
    
  } catch (error) {
    spinner.fail('Build failed');
    console.error(chalk.red(error.message));
  }
}

module.exports = compile; 