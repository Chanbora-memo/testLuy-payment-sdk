/**
 * Test runner script for testluy-payment-sdk
 * 
 * This script runs the unit tests for the SDK components.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the Jest command
const jestBin = join(__dirname, 'node_modules', '.bin', 'jest');
const args = process.argv.slice(2);

// Run Jest with the provided arguments
const jest = spawn('node', ['--experimental-vm-modules', jestBin, ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

// Handle process exit
jest.on('close', (code) => {
  process.exit(code);
});