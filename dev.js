#!/usr/bin/env node

/**
 * BoardCollab Unified Process Runner
 * Starts both Backend (Express + Socket.IO) and Frontend (React + Vite)
 * in a single unified command with colored console streaming.
 */

const { spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// ANSI terminal colors
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
};

console.log(`${colors.bold}${colors.green}======================================================${colors.reset}`);
console.log(`${colors.bold}${colors.green}  BoardCollab - Unified Real-Time Collaboration Stack  ${colors.reset}`);
console.log(`${colors.bold}${colors.green}======================================================${colors.reset}\n`);
console.log(`${colors.dim}Starting Backend and Frontend processes concurrently...${colors.reset}\n`);

// 1. Spawn Backend Process via npm workspace
const backend = spawn(npmCmd, ['run', 'dev', '--workspace=server'], {
  cwd: __dirname,
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

// 2. Spawn Frontend Process via npm workspace
const frontend = spawn(npmCmd, ['run', 'dev', '--workspace=client'], {
  cwd: __dirname,
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

const pipeOutput = (child, prefix, color) => {
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${color}${colors.bold}[${prefix}]${colors.reset} ${line}`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${color}${colors.bold}[${prefix}]${colors.reset} ${colors.yellow}${line}${colors.reset}`);
      }
    });
  });
};

pipeOutput(backend, 'BACKEND', colors.cyan);
pipeOutput(frontend, 'FRONTEND', colors.magenta);

// Handle process termination
const cleanup = () => {
  console.log(`\n${colors.yellow}Stopping BoardCollab services...${colors.reset}`);
  if (isWindows) {
    if (backend.pid) spawn('taskkill', ['/pid', backend.pid, '/f', '/t']);
    if (frontend.pid) spawn('taskkill', ['/pid', frontend.pid, '/f', '/t']);
  } else {
    backend.kill('SIGINT');
    frontend.kill('SIGINT');
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
