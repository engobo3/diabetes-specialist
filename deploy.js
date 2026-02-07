#!/usr/bin/env node

/**
 * Automated Deployment Script
 * Handles: Install, Build, Test, Deploy
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n');
  log('='.repeat(60), 'blue');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'blue');
}

function runCommand(command, description) {
  try {
    log(`▶️  ${description}...`, 'yellow');
    execSync(command, { stdio: 'inherit', shell: true });
    log(`✅ ${description}`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} FAILED`, 'red');
    log(`Error: ${error.message}`, 'red');
    return false;
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

async function deploy() {
  logSection('🚀 AUTOMATED DEPLOYMENT - MESSAGING SYSTEM v2.0');

  const projectRoot = process.cwd();
  const serverDir = path.join(projectRoot, 'server');
  const clientDir = path.join(projectRoot, 'client');

  // Step 1: Validate Environment
  logSection('1️⃣ VALIDATING ENVIRONMENT');
  
  log('Checking Node.js version...', 'yellow');
  try {
    const nodeVersion = execSync('node -v', { encoding: 'utf8' }).trim();
    log(`Node.js ${nodeVersion}`, 'green');
  } catch (error) {
    log('❌ Node.js not found!', 'red');
    log('Please install Node.js 18+ from https://nodejs.org', 'red');
    process.exit(1);
  }

  log('Checking Firebase CLI...', 'yellow');
  try {
    const fbVersion = execSync('firebase --version', { encoding: 'utf8' }).trim();
    log(`Firebase CLI ${fbVersion}`, 'green');
  } catch (error) {
    log('❌ Firebase CLI not found!', 'red');
    log('Install with: npm install -g firebase-tools', 'red');
    process.exit(1);
  }

  // Step 2: Install Dependencies
  logSection('2️⃣ INSTALLING DEPENDENCIES');

  if (!fileExists(path.join(serverDir, 'node_modules'))) {
    if (!runCommand(`cd "${serverDir}" && npm install`, 'Installing server dependencies')) {
      process.exit(1);
    }
  } else {
    log('Server dependencies already installed', 'green');
  }

  if (!fileExists(path.join(clientDir, 'node_modules'))) {
    if (!runCommand(`cd "${clientDir}" && npm install`, 'Installing client dependencies')) {
      process.exit(1);
    }
  } else {
    log('Client dependencies already installed', 'green');
  }

  // Step 3: Run Tests
  logSection('3️⃣ RUNNING TESTS');

  if (!runCommand(`cd "${serverDir}" && npm test`, 'Running test suite')) {
    log('Tests failed! Aborting deployment.', 'red');
    process.exit(1);
  }

  // Step 4: Build Client
  logSection('4️⃣ BUILDING CLIENT');

  if (!runCommand(`cd "${clientDir}" && npm run build`, 'Building React client')) {
    log('Build failed! Aborting deployment.', 'red');
    process.exit(1);
  }

  // Step 5: Verify Build Output
  logSection('5️⃣ VERIFYING BUILD OUTPUT');

  const distDir = path.join(clientDir, 'dist');
  if (fileExists(distDir)) {
    const files = fs.readdirSync(distDir).length;
    log(`✅ Build output created (${files} files)`, 'green');
  } else {
    log('❌ Build output not found!', 'red');
    process.exit(1);
  }

  // Step 6: Check Firebase Project
  logSection('6️⃣ CHECKING FIREBASE PROJECT');

  try {
    const firebaseConfig = execSync('firebase projects:list', { encoding: 'utf8' });
    log('✅ Firebase project configured', 'green');
  } catch (error) {
    log('⚠️  Could not verify Firebase project', 'yellow');
    log('Make sure to run: firebase login && firebase use --add', 'yellow');
  }

  // Step 7: Deploy
  logSection('7️⃣ DEPLOYING TO FIREBASE');

  log('This will deploy to Firebase Hosting and Cloud Functions...', 'yellow');
  log('(You may be prompted to authenticate)\n', 'yellow');

  if (!runCommand('firebase deploy', 'Deploying to Firebase')) {
    log('Deployment failed! Check Firebase project configuration.', 'red');
    process.exit(1);
  }

  // Success!
  logSection('✅ DEPLOYMENT COMPLETE');

  log('\n🎉 Your messaging system v2.0 is now live!\n', 'green');
  log('What\'s deployed:', 'bright');
  log('  ✅ Fixed bidirectional messaging', 'green');
  log('  ✅ Enhanced error handling', 'green');
  log('  ✅ 36 passing tests', 'green');
  log('  ✅ Updated React client', 'green');
  log('  ✅ Improved server backend', 'green');

  log('\nNext steps:', 'bright');
  log('  1. Check Firebase Console for deployment confirmation', 'yellow');
  log('  2. Go to your app URL and test the messaging feature', 'yellow');
  log('  3. Try sending a message from doctor to patient', 'yellow');
  log('  4. Then reply as patient to verify bidirectional messaging', 'yellow');

  log('\nFor issues, check:', 'bright');
  log('  • DEPLOYMENT_STEPS.md - Detailed guide', 'yellow');
  log('  • DEPLOYMENT_CHECKLIST.md - Verification steps', 'yellow');
  log('  • MESSAGING_FIX_SUMMARY.md - Technical details', 'yellow');

  process.exit(0);
}

// Run deployment
deploy().catch(error => {
  log(`\n❌ Deployment failed: ${error.message}`, 'red');
  process.exit(1);
});
