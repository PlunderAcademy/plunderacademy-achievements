#!/usr/bin/env node

/**
 * Upload training assets to Cloudflare R2 bucket
 * 
 * By default, only uploads missing files (files that don't exist in R2).
 * Use --force flag to upload all files, overwriting existing ones.
 * 
 * Recursively uploads all files from the training/ directory, preserving folder structure.
 * Supports all file types including JSON metadata, images (PNG, WebP, JPEG, etc.), 
 * and any other assets needed for the training system.
 * 
 * Usage:
 *   node upload-training.js                              # Upload only missing files
 *   node upload-training.js --force                      # Upload all files, overwriting existing
 *   node upload-training.js images/0054-plain-card.webp  # Upload specific file only
 *   node upload-training.js images/0054-plain-card.webp --force  # Upload specific file, overwriting
 * 
 * Required environment variables (can be set via .env file or system environment):
 * - R2_ACCOUNT_ID: Your Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API token access key ID
 * - R2_ACCESS_KEY_SECRET: R2 API token secret key
 * - R2_BUCKET_NAME: Name of your R2 bucket
 */

// Load environment variables from .env files
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const FORCE_UPLOAD = args.includes('--force') || args.includes('-f');
const SPECIFIC_FILE = args.find(arg => !arg.startsWith('-'));

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Configuration
const REQUIRED_ENV_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID', 
  'R2_ACCESS_KEY_SECRET',
  'R2_BUCKET_NAME'
];

const TRAINING_DIR = path.join(__dirname, '..', 'training');

// Validate environment variables
function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => console.error(`   - ${envVar}`));
    console.error('\nPlease set these environment variables and try again.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
}

// Initialize R2 client
function createR2Client() {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_ACCESS_KEY_SECRET,
    },
  });
  
  console.log('✅ R2 client initialized');
  return client;
}

// Get MIME type based on file extension
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.tiff': 'image/tiff',
    '.avif': 'image/avif',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// Check if file exists in R2
async function fileExists(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

// Upload a single file to R2
async function uploadFile(client, bucket, localPath, remoteKey) {
  // Check if file already exists
  const exists = await fileExists(client, bucket, remoteKey);
  
  if (exists && !FORCE_UPLOAD) {
    console.log(`⏭️  Skipped: ${remoteKey} (already exists)`);
    return 'skipped';
  }
  
  const fileContent = fs.readFileSync(localPath);
  const mimeType = getMimeType(localPath);
  
  if (exists && FORCE_UPLOAD) {
    console.log(`⚠️  File ${remoteKey} already exists, overwriting...`);
  }
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: remoteKey,
    Body: fileContent,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000', // 1 year cache for training assets
  });
  
  try {
    await client.send(command);
    console.log(`✅ Uploaded: ${localPath} → ${remoteKey}`);
    return 'uploaded';
  } catch (error) {
    console.error(`❌ Failed to upload ${remoteKey}:`, error.message);
    return 'failed';
  }
}

// Recursively get all files from a directory
function getAllFilesRecursively(dir, baseDir, files = []) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recursively scan subdirectories
      getAllFilesRecursively(fullPath, baseDir, files);
    } else if (stat.isFile()) {
      // Calculate relative path from base directory
      const relativePath = path.relative(baseDir, fullPath);
      // Convert Windows paths to forward slashes for R2
      const remoteKey = `training/${relativePath.replace(/\\/g, '/')}`;
      
      files.push({
        localPath: fullPath,
        remoteKey: remoteKey
      });
    }
  });
  
  return files;
}

// Get all files to upload from training directory
function getFilesToUpload() {
  // If a specific file is requested, only process that file
  if (SPECIFIC_FILE) {
    let localPath;
    
    // Check if it's a relative path from training directory
    const trainingRelative = path.join(TRAINING_DIR, SPECIFIC_FILE);
    if (fs.existsSync(trainingRelative)) {
      localPath = trainingRelative;
    } else if (fs.existsSync(SPECIFIC_FILE)) {
      // Use as-is if it exists
      localPath = SPECIFIC_FILE;
    } else {
      throw new Error(`File not found: ${SPECIFIC_FILE}`);
    }
    
    // Make sure it's actually a file
    if (!fs.statSync(localPath).isFile()) {
      throw new Error(`Not a file: ${localPath}`);
    }
    
    // Calculate remote key
    const relativePath = path.relative(TRAINING_DIR, localPath);
    const remoteKey = `training/${relativePath.replace(/\\/g, '/')}`;
    
    return [{
      localPath: localPath,
      remoteKey: remoteKey
    }];
  }
  
  // Check if training directory exists
  if (!fs.existsSync(TRAINING_DIR)) {
    throw new Error(`Training directory not found: ${TRAINING_DIR}`);
  }
  
  // Get all files recursively from training directory
  const files = getAllFilesRecursively(TRAINING_DIR, TRAINING_DIR);
  
  return files;
}

// Main upload function
async function uploadTrainingAssets() {
  const mode = FORCE_UPLOAD ? 'all training assets (overwriting existing)' : 'missing training assets only';
  console.log(`🚀 Starting recursive upload of ${mode} to R2...\n`);
  
  try {
    // Validate environment
    validateEnvironment();
    
    // Initialize R2 client
    const client = createR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    
    // Get files to upload
    const files = getFilesToUpload();
    console.log(`📁 Found ${files.length} files to process from training/ directory:`);
    
    if (FORCE_UPLOAD) {
      console.log('🔄 Force mode: Will overwrite existing files');
    } else {
      console.log('⚡ Smart mode: Will skip existing files');
    }
    
    // List all files that will be processed
    files.forEach(file => {
      console.log(`   📄 ${file.remoteKey}`);
    });
    console.log(''); // Empty line
    
    if (files.length === 0) {
      console.log('⚠️  No files found to process');
      return;
    }
    
    // Process files
    let uploaded = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const file of files) {
      const result = await uploadFile(client, bucket, file.localPath, file.remoteKey);
      if (result === 'uploaded') {
        uploaded++;
      } else if (result === 'skipped') {
        skipped++;
      } else {
        failed++;
      }
    }
    
    // Summary
    console.log('\n📊 Upload Summary:');
    console.log(`   ✅ Uploaded: ${uploaded}`);
    if (skipped > 0) {
      console.log(`   ⏭️  Skipped: ${skipped} (already exist)`);
    }
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📦 Bucket: ${bucket}`);
    console.log(`   🌍 Access URL: https://${bucket}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/`);
    
    if (failed > 0) {
      console.log('\n⚠️  Some files failed to upload. Check the error messages above.');
      process.exit(1);
    } else if (uploaded > 0) {
      console.log(`\n🎉 Successfully uploaded ${uploaded} files!`);
      if (skipped > 0) {
        console.log(`💡 Tip: Use --force flag to overwrite the ${skipped} existing files`);
      }
    } else if (skipped > 0) {
      console.log('\n✨ All files already exist in R2! Use --force flag to overwrite them.');
    }
    
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  uploadTrainingAssets();
}

module.exports = { uploadTrainingAssets };
