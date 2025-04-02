const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

class GitManager {
  constructor(projectPath) {
    this.git = simpleGit(projectPath);
    this.projectPath = projectPath;
  }

  async initialize() {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        console.log(chalk.yellow('Initializing Git repository...'));
        await this.git.init();
        await this.createGitignore();
      }
    } catch (error) {
      console.error(chalk.red('Error initializing Git:', error.message));
    }
  }

  async createGitignore() {
    const gitignorePath = path.join(this.projectPath, '.gitignore');
    const gitignoreContent = `
# Dependencies
node_modules/
.pnp
.pnp.js

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build output
dist/
build/
out/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Blockchain
.anchor
target/
test-ledger/
`;

    await fs.writeFile(gitignorePath, gitignoreContent.trim());
  }

  async isClean() {
    const status = await this.git.status();
    return status.isClean();
  }

  async getChangedFiles() {
    const status = await this.git.status();
    return {
      modified: status.modified,
      created: status.created,
      deleted: status.deleted
    };
  }

  async stageFiles(files) {
    if (!Array.isArray(files)) {
      files = [files];
    }
    await this.git.add(files);
  }

  async commit(message) {
    try {
      const status = await this.git.status();
      
      if (status.staged.length === 0 && status.modified.length > 0) {
        // Stage all modified files if none are staged
        await this.git.add(status.modified);
      }

      await this.git.commit(message);
      console.log(chalk.green('Changes committed successfully'));
    } catch (error) {
      console.error(chalk.red('Error committing changes:', error.message));
    }
  }

  async generateCommitMessage(files) {
    const changes = await this.getChangedFiles();
    const fileList = [...changes.modified, ...changes.created, ...changes.deleted];
    
    let message = '';
    
    if (changes.created.length > 0) {
      message += 'Add ' + changes.created.join(', ') + '\n';
    }
    
    if (changes.modified.length > 0) {
      message += 'Update ' + changes.modified.join(', ') + '\n';
    }
    
    if (changes.deleted.length > 0) {
      message += 'Remove ' + changes.deleted.join(', ') + '\n';
    }
    
    return message.trim();
  }

  async commitChanges(files, customMessage = '') {
    try {
      await this.stageFiles(files);
      const message = customMessage || await this.generateCommitMessage(files);
      await this.commit(message);
    } catch (error) {
      console.error(chalk.red('Error committing changes:', error.message));
    }
  }
}

module.exports = GitManager; 