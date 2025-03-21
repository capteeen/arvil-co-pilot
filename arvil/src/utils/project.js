const fs = require('fs-extra');
const path = require('path');

/**
 * Check if the current directory is an ARVIL project
 * @returns {boolean} - True if in an ARVIL project directory
 */
function isProjectDirectory() {
  try {
    // Check for package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }
    
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check if it's likely an ARVIL project
    // Either created by ARVIL or has blockchain-related dependencies
    const isCreatedByArvil = packageJson.description && packageJson.description.includes('ARVIL');
    const hasBlockchainDeps = 
      (packageJson.dependencies && (
        packageJson.dependencies['@solana/web3.js'] ||
        packageJson.dependencies['web3'] ||
        packageJson.dependencies['ethers']
      )) ||
      (packageJson.devDependencies && (
        packageJson.devDependencies['@solana/web3.js'] ||
        packageJson.devDependencies['web3'] ||
        packageJson.devDependencies['ethers']
      ));
    
    return isCreatedByArvil || hasBlockchainDeps;
  } catch (error) {
    return false;
  }
}

/**
 * Get information about the current project
 * @returns {Object} - Project information
 */
function getProjectInfo() {
  // Check if in a project directory
  if (!isProjectDirectory()) {
    throw new Error('Not in an ARVIL project directory');
  }
  
  // Read package.json
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Get directory structure
  const structure = scanDirectory(process.cwd(), 2);
  
  return {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    dependencies: {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    },
    structure
  };
}

/**
 * Scan directory to get file structure
 * @param {string} dir - Directory to scan
 * @param {number} depth - Maximum depth to scan
 * @returns {Object} - Directory structure
 */
function scanDirectory(dir, depth = 2, currentDepth = 0) {
  if (currentDepth >= depth) {
    return null;
  }
  
  const result = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    
    // Skip hidden files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }
    
    if (entry.isDirectory()) {
      const subDir = scanDirectory(entryPath, depth, currentDepth + 1);
      if (subDir !== null) {
        result[entry.name] = subDir;
      } else {
        result[entry.name] = '[directory]';
      }
    } else {
      // Only show JavaScript, TypeScript, Rust, and Solidity files
      const ext = path.extname(entry.name).toLowerCase();
      if (['.js', '.ts', '.jsx', '.tsx', '.rs', '.sol'].includes(ext)) {
        result[entry.name] = '[file]';
      }
    }
  }
  
  return result;
}

/**
 * Read file content for context
 * @param {string} filePath - Path to the file
 * @returns {string} - File content
 */
function getFileContent(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  return fs.readFileSync(filePath, 'utf8');
}

module.exports = {
  isProjectDirectory,
  getProjectInfo,
  scanDirectory,
  getFileContent
}; 