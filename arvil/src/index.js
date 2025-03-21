#!/usr/bin/env node

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// Load environment variables from .env file if it exists
dotenv.config();

// Load global configuration if it exists
const globalConfigPath = path.join(os.homedir(), '.arvil.json');
if (fs.existsSync(globalConfigPath)) {
  try {
    const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
    
    // Set environment variables from global config if not already set
    for (const [key, value] of Object.entries(globalConfig)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    // Ignore errors reading global config
  }
}

// Import CLI module
require('./cli'); 