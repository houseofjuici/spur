#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const packageDir = path.join(rootDir, 'package');

async function packageExtension() {
  console.log('📦 Packaging Chrome extension...');

  try {
    // Ensure build directory exists
    if (!(await fs.pathExists(buildDir))) {
      throw new Error('Build directory does not exist. Run "npm run build" first.');
    }

    // Create package directory
    await fs.ensureDir(packageDir);

    // Get version from package.json
    const packageJson = await fs.readJSON(path.join(rootDir, 'package.json'));
    const version = packageJson.version;
    const packageName = `spur-extension-v${version}.zip`;
    const packagePath = path.join(packageDir, packageName);

    // Create archive
    const output = fs.createWriteStream(packagePath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log('✅ Extension packaged successfully!');
      console.log(`📦 Package: ${packagePath}`);
      console.log(`📊 Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    // Add all files from build directory
    archive.directory(buildDir, false);

    // Add additional files
    const readmePath = path.join(rootDir, 'README.md');
    if (await fs.pathExists(readmePath)) {
      archive.file(readmePath, { name: 'README.md' });
    }

    const licensePath = path.join(rootDir, 'LICENSE');
    if (await fs.pathExists(licensePath)) {
      archive.file(licensePath, { name: 'LICENSE' });
    }

    await archive.finalize();

    // Create package info file
    const packageInfo = {
      version,
      packageName,
      createdAt: new Date().toISOString(),
      size: 0, // Will be updated after archive is complete
      buildFiles: await fs.readdir(buildDir)
    };

    output.on('close', () => {
      packageInfo.size = archive.pointer();
      const infoPath = path.join(packageDir, `spur-extension-v${version}-info.json`);
      fs.writeJSON(infoPath, packageInfo, { spaces: 2 });
    });

  } catch (error) {
    console.error('❌ Error packaging extension:', error);
    process.exit(1);
  }
}

packageExtension();