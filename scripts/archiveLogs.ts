import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const logsDir = path.join(__dirname, '../logs');
const archiveDir = path.join(logsDir, 'archive');

// Ensure the archive directory exists
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir);
}

fs.readdir(logsDir, (err, files) => {
  if (err) {
    console.error('Error reading logs directory:', err);
    return;
  }

  files.forEach((file) => {
    const filePath = path.join(logsDir, file);

    // Skip directories and already compressed files
    if (fs.lstatSync(filePath).isDirectory() || file.endsWith('.gz')) {
      return;
    }

    const archivePath = path.join(archiveDir, `${file}.gz`);

    // Compress the log file
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(archivePath);
    const gzip = zlib.createGzip();

    readStream
      .pipe(gzip)
      .pipe(writeStream)
      .on('finish', () => {
        console.log(`Archived: ${file}`);

        // Delete the original file after archiving
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting original log file:', unlinkErr);
          }
        });
      });
  });
});