const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

// Path to store project metadata
const ARVIL_CONFIG_DIR = path.join(os.homedir(), '.arvil');
const PROJECTS_FILE = path.join(ARVIL_CONFIG_DIR, 'projects.json');

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
 * @returns {Object} Project information
 */
function getProjectInfo() {
  // Check if in a project directory
  if (!isInProject()) {
    throw new Error('Not in a project directory');
  }

  const packageJsonPath = findPackageJson();
  if (!packageJsonPath) {
    throw new Error('package.json not found');
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return {
      name: packageJson.name || 'unknown',
      description: packageJson.description || '',
      version: packageJson.version || '0.0.1',
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      path: path.dirname(packageJsonPath),
      type: detectProjectType(packageJson)
    };
  } catch (error) {
    throw new Error(`Failed to parse package.json: ${error.message}`);
  }
}

/**
 * Check if currently in a project directory
 * @returns {boolean} True if in a project directory
 */
function isInProject() {
  return !!findPackageJson();
}

/**
 * Find the nearest package.json file by traversing up directories
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} Path to package.json or null if not found
 */
function findPackageJson(startDir = process.cwd()) {
  let currentDir = startDir;
  const maxDepth = 5; // Limit how far up to look
  
  for (let i = 0; i < maxDepth; i++) {
    const packagePath = path.join(currentDir, 'package.json');
    
    if (fs.existsSync(packagePath)) {
      // Check if this is actually an ARVIL project
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        // Check for ARVIL markers in package.json or look for certain files
        if (isArvilProject(pkg, currentDir)) {
          return packagePath;
        }
      } catch (error) {
        // If we can't read it, just continue searching
      }
    }
    
    // Go up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // We've reached the root
      break;
    }
    currentDir = parentDir;
  }
  
  return null;
}

/**
 * Check if a directory is an ARVIL project
 * @param {Object} packageJson - Package.json content
 * @param {string} dir - Directory to check
 * @returns {boolean} True if it's an ARVIL project
 */
function isArvilProject(packageJson, dir) {
  // Check for ARVIL as a dependency
  if (packageJson.dependencies && packageJson.dependencies['arvil-cli']) {
    return true;
  }
  
  // Check for ARVIL keyword
  if (packageJson.keywords && packageJson.keywords.includes('arvil')) {
    return true;
  }
  
  // Check for ARVIL config file
  if (fs.existsSync(path.join(dir, '.arvil'))) {
    return true;
  }
  
  // Check known projects list
  const knownProjects = listRegisteredProjects();
  const normalizedPath = path.normalize(dir);
  return knownProjects.some(project => path.normalize(project.path) === normalizedPath);
}

/**
 * Detect the type of project
 * @param {Object} packageJson - Package.json content
 * @returns {string} Project type (solana, evm, etc.)
 */
function detectProjectType(packageJson) {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps['@solana/web3.js'] || deps['@solana/spl-token']) {
    return 'solana';
  } else if (deps['web3'] || deps['ethers'] || deps['@openzeppelin/contracts']) {
    return 'evm';
  } else if (deps['near-api-js']) {
    return 'near';
  } else {
    return 'unknown';
  }
}

/**
 * Register a new project in the ARVIL projects list
 * @param {string} name - Project name
 * @param {string} projectPath - Absolute path to the project
 * @param {string} type - Project type (solana, evm, etc.)
 */
function registerProject(name, projectPath, type = 'solana') {
  // Ensure the ARVIL config directory exists
  fs.ensureDirSync(ARVIL_CONFIG_DIR);
  
  // Load existing projects
  let projects = [];
  if (fs.existsSync(PROJECTS_FILE)) {
    try {
      projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    } catch (error) {
      console.error(chalk.yellow(`Warning: Could not read projects file: ${error.message}`));
      // Continue with empty projects list
    }
  }
  
  // Normalize path for consistency
  const normalizedPath = path.normalize(projectPath);
  
  // Check if project already exists
  const existingIndex = projects.findIndex(p => 
    path.normalize(p.path) === normalizedPath || p.name === name);
  
  if (existingIndex >= 0) {
    // Update existing project
    projects[existingIndex] = {
      name,
      path: normalizedPath,
      type,
      lastModified: new Date().toISOString()
    };
  } else {
    // Add new project
    projects.push({
      name,
      path: normalizedPath,
      type,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString()
    });
  }
  
  // Save updated projects list
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf8');
  } catch (error) {
    console.error(chalk.red(`Error: Failed to register project: ${error.message}`));
  }
}

/**
 * Update a project's last modified timestamp
 * @param {string} projectPath - Absolute path to the project
 */
function updateProjectTimestamp(projectPath) {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return;
  }
  
  const normalizedPath = path.normalize(projectPath);
  
  try {
    const projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    const projectIndex = projects.findIndex(p => path.normalize(p.path) === normalizedPath);
    
    if (projectIndex >= 0) {
      projects[projectIndex].lastModified = new Date().toISOString();
      fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf8');
    }
  } catch (error) {
    // Silently fail - this is just a convenience update
  }
}

/**
 * Get a list of all registered ARVIL projects
 * @returns {Array} List of project objects
 */
function listRegisteredProjects() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return [];
  }
  
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not read projects file: ${error.message}`));
    return [];
  }
}

/**
 * Get the absolute path for a specific project by name
 * @param {string} projectName - Name of the project to find
 * @returns {string|null} Absolute path to the project or null if not found
 */
function getProjectPath(projectName) {
  const projects = listRegisteredProjects();
  const project = projects.find(p => p.name === projectName);
  return project ? project.path : null;
}

/**
 * Get the current project if we're in one
 * @returns {Object|null} Project info or null if not in a project
 */
function getCurrentProject() {
  try {
    return getProjectInfo();
  } catch (error) {
    return null;
  }
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
  getFileContent,
  isInProject,
  findPackageJson,
  registerProject,
  listRegisteredProjects,
  getProjectPath,
  updateProjectTimestamp,
  getCurrentProject
}; 