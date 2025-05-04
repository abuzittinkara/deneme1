/**
 * tests/globalTeardown.js
 * Jest global temizlik
 */
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

module.exports = async () => {
  // Test uploads dizinini temizle
  const testUploadsDir = path.resolve(process.cwd(), 'uploads/test');
  
  if (fs.existsSync(testUploadsDir)) {
    rimraf.sync(testUploadsDir);
    console.log('Test uploads directory cleaned.');
  }
  
  console.log('Global teardown completed.');
};
