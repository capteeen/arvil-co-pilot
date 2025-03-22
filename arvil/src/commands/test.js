const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { isProjectDirectory } = require('../utils/project');

// Define global describe and test functions for non-test environments
// to prevent 'describe is not defined' errors
if (typeof describe === 'undefined') {
  global.describe = () => {};
  global.test = () => {};
  global.expect = () => ({ toBe: () => {} });
}

/**
 * Run tests for the project
 */
async function test() {
  // Check if we're in a project directory
  if (!isProjectDirectory()) {
    console.log(chalk.red('Error: Not in an ARVIL project directory.'));
    console.log(chalk.yellow('Please run this command from the root of an ARVIL project.'));
    return;
  }

  // Determine project type and run appropriate tests
  if (fs.existsSync('Cargo.toml')) {
    await runRustTests();
  } else if (fs.existsSync('package.json')) {
    await runJsTests();
  } else {
    console.log(chalk.red('Error: Could not determine project type.'));
    console.log(chalk.yellow('Make sure you have the necessary configuration files (Cargo.toml or package.json).'));
  }
}

/**
 * Run tests for Rust projects
 */
async function runRustTests() {
  const spinner = ora('Running Rust tests...').start();
  
  try {
    // Check for Rust
    try {
      await execAsync('cargo --version');
    } catch (error) {
      spinner.fail('Rust is not installed');
      console.log(chalk.yellow('Please install Rust:'));
      console.log(chalk.cyan('  curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh'));
      return;
    }
    
    // Check for Solana BPF tools
    let usesBpfTests = false;
    try {
      const cargoToml = fs.readFileSync('Cargo.toml', 'utf8');
      usesBpfTests = cargoToml.includes('solana-program-test') || cargoToml.includes('solana-sdk/test');
    } catch (error) {
      // Ignore read errors
    }
    
    // Run the appropriate test command
    let testCommand = 'cargo test';
    if (usesBpfTests) {
      testCommand = 'cargo test-bpf';
      
      // Check if test-bpf is available
      try {
        await execAsync('cargo test-bpf --help');
      } catch (error) {
        spinner.warn('Solana BPF test tools not found');
        console.log(chalk.yellow('Falling back to standard cargo test'));
        testCommand = 'cargo test';
      }
    }
    
    spinner.text = `Running ${usesBpfTests ? 'BPF' : 'Rust'} tests...`;
    
    const { stdout, stderr } = await execAsync(testCommand);
    
    // Check if tests passed
    if (stderr && stderr.includes('error:')) {
      spinner.fail('Tests failed');
      console.error(chalk.red(stderr));
      return;
    }
    
    if (stdout.includes('test result: ok')) {
      spinner.succeed('All tests passed');
      
      // Extract test count
      const testCountMatch = stdout.match(/(\d+) passed/);
      if (testCountMatch) {
        console.log(chalk.green(`\n${testCountMatch[1]} tests passed successfully`));
      }
    } else {
      spinner.warn('Tests completed with warnings or failures');
      console.log(stdout);
    }
    
  } catch (error) {
    spinner.fail('Failed to run tests');
    console.error(chalk.red(error.message));
  }
}

/**
 * Run tests for JavaScript projects
 */
async function runJsTests() {
  const spinner = ora('Running JavaScript tests...').start();
  
  try {
    // Check for package.json
    if (!fs.existsSync('package.json')) {
      spinner.fail('package.json not found');
      return;
    }
    
    // Read package.json to determine test command
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    if (!packageJson.scripts || !packageJson.scripts.test) {
      spinner.fail('No test script found in package.json');
      console.log(chalk.yellow('Please add a test script to your package.json:'));
      console.log(chalk.cyan('  "scripts": {\n    "test": "jest"\n  }'));
      
      // Check if Jest is installed
      if (fs.existsSync('node_modules/.bin/jest')) {
        console.log(chalk.yellow('\nTrying to run Jest directly...'));
        spinner.text = 'Running Jest tests...';
        spinner.start();
        
        try {
          await execAsync('node_modules/.bin/jest');
          spinner.succeed('Tests completed successfully');
        } catch (jestError) {
          spinner.fail('Jest tests failed');
          console.error(chalk.red(jestError.message));
        }
      }
      
      return;
    }
    
    // Run the test script
    spinner.text = 'Running tests...';
    
    const { stdout, stderr } = await execAsync('npm test');
    
    if (stderr && stderr.includes('error')) {
      spinner.fail('Tests failed');
      console.error(chalk.red(stderr));
      return;
    }
    
    // Check for common test output patterns
    if (stdout.includes('PASS') && !stdout.includes('FAIL')) {
      spinner.succeed('All tests passed');
    } else if (stdout.includes('FAIL')) {
      spinner.fail('Some tests failed');
      console.log(stdout);
    } else {
      spinner.succeed('Tests completed');
      console.log(stdout);
    }
    
  } catch (error) {
    spinner.fail('Failed to run tests');
    console.error(chalk.red(error.message));
  }
}

module.exports = test; 