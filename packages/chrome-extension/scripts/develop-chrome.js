#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');

async function developChrome() {
  console.log('🔧 Setting up Chrome extension development...');

  try {
    // Ensure build directory exists and is up to date
    await prepareBuildDirectory();

    // Start development server
    console.log('🚀 Starting development server...');
    const viteProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      cwd: rootDir,
      shell: true
    });

    // Watch for file changes and rebuild
    console.log('👀 Watching for file changes...');
    setupFileWatcher();

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping development server...');
      viteProcess.kill();
      process.exit(0);
    });

    console.log('✅ Development environment ready!');
    console.log('📂 Load extension in Chrome:');
    console.log('   1. Open chrome://extensions/');
    console.log('   2. Enable "Developer mode"');
    console.log('   3. Click "Load unpacked"');
    console.log(`   4. Select: ${buildDir}`);
    console.log('\n🔄 The extension will automatically reload when files change.');

  } catch (error) {
    console.error('❌ Error setting up development:', error);
    process.exit(1);
  }
}

async function prepareBuildDirectory() {
  await fs.ensureDir(buildDir);

  // Copy manifest.json
  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifestDest = path.join(buildDir, 'manifest.json');
  await fs.copy(manifestPath, manifestDest);

  // Copy assets
  const assetsDir = path.join(rootDir, 'assets');
  const assetsDest = path.join(buildDir, 'assets');
  if (await fs.pathExists(assetsDir)) {
    await fs.copy(assetsDir, assetsDest);
  }

  // Copy options.html
  const optionsHtml = path.join(rootDir, 'options.html');
  const optionsHtmlDest = path.join(buildDir, 'options.html');
  await fs.copy(optionsHtml, optionsHtmlDest);

  console.log('✅ Build directory prepared');
}

function setupFileWatcher() {
  const { watch } = require('fs');
  const srcDir = path.join(rootDir, 'src');

  watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (filename && eventType === 'change') {
      console.log(`📝 File changed: ${filename}`);
      // Trigger rebuild through Vite's watch mode
      // The development server will handle hot reload
    }
  });
}

developChrome();