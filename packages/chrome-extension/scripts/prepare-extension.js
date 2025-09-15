#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const distDir = path.join(rootDir, 'dist');

async function prepareExtension() {
  console.log('🚀 Preparing Chrome extension build...');

  try {
    // Ensure build directory exists
    await fs.ensureDir(buildDir);

    // Copy manifest.json
    const manifestPath = path.join(rootDir, 'manifest.json');
    const manifestDest = path.join(buildDir, 'manifest.json');
    await fs.copy(manifestPath, manifestDest);
    console.log('✅ Copied manifest.json');

    // Copy built files from dist to build
    if (await fs.pathExists(distDir)) {
      const files = await fs.readdir(distDir);
      for (const file of files) {
        const srcPath = path.join(distDir, file);
        const destPath = path.join(buildDir, file);
        await fs.copy(srcPath, destPath);
      }
      console.log('✅ Copied built files');
    }

    // Copy assets
    const assetsDir = path.join(rootDir, 'assets');
    if (await fs.pathExists(assetsDir)) {
      const assetsDest = path.join(buildDir, 'assets');
      await fs.copy(assetsDir, assetsDest);
      console.log('✅ Copied assets');
    }

    // Copy options.html
    const optionsHtml = path.join(rootDir, 'options.html');
    const optionsHtmlDest = path.join(buildDir, 'options.html');
    await fs.copy(optionsHtml, optionsHtmlDest);
    console.log('✅ Copied options.html');

    // Create _metadata file for build info
    const metadata = {
      buildTime: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      files: await fs.readdir(buildDir)
    };

    await fs.writeJSON(path.join(buildDir, '_metadata.json'), metadata, { spaces: 2 });
    console.log('✅ Created build metadata');

    console.log('🎉 Chrome extension build prepared successfully!');
    console.log(`📁 Build directory: ${buildDir}`);
    
  } catch (error) {
    console.error('❌ Error preparing extension:', error);
    process.exit(1);
  }
}

prepareExtension();