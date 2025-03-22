// Only define test functions in a test environment
if (process.env.NODE_ENV === 'test') {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const path = require('path');

  // Path to CLI script - Fix the path to use the correct directory
  const CLI_PATH = path.resolve(__dirname, '../src/cli.js');

  describe('ARVIL CLI', () => {
    // Test that CLI executes and shows help
    test('Should display help information', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} --help`);
      
      // Check for expected command information in help output
      expect(stdout).toContain('ARVIL');
      expect(stdout).toContain('init');
      expect(stdout).toContain('deploy');
      expect(stdout).toContain('assist');
      expect(stdout).toContain('compile');
      expect(stdout).toContain('test');
      expect(stdout).toContain('config');
    });

    // Test version output
    test('Should display version information', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} --version`);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Semver format
    });
  });
} else {
  // Export dummy module when not in test environment
  module.exports = {};
} 