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
        // Clean multi-line values and strip any unexpected characters
        if (typeof value === 'string') {
          // Clean any multi-line API keys or values by removing whitespace, newlines, etc.
          const cleanedValue = value.replace(/[\s\n\r]+/g, '');
          process.env[key] = cleanedValue;
        } else {
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    // Log the error for better debugging but continue execution
    console.error(`Error loading global config: ${error.message}`);
  }
}

// Import CLI module
require('./cli'); 