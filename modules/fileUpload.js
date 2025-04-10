/**************************************
 * modules/fileUpload.js
 **************************************/
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileAttachment = require('../models/FileAttachment');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper function to save a file to disk
async function saveFileToDisk(fileData, originalName) {
  // Generate a unique filename to avoid collisions
  const fileExtension = path.extname(originalName);
  const serverFilename = `${uuidv4()}${fileExtension}`;
  const filePath = path.join(uploadsDir, serverFilename);
  
  // Convert base64 data to buffer and save to disk
  const base64Data = fileData.replace(/^data:([A-Za-z-+/]+);base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          serverFilename,
          filePath: `/uploads/${serverFilename}`,
          size: buffer.length
        });
      }
    });
  });
}

// Function to handle file upload and create FileAttachment record
async function handleFileUpload(fileData, originalName, mimeType, userId, messageId = null, dmMessageId = null) {
  try {
    const { serverFilename, filePath, size } = await saveFileToDisk(fileData, originalName);
    
    // Create a new FileAttachment record
    const fileAttachment = new FileAttachment({
      originalName,
      serverFilename,
      mimeType,
      size,
      uploader: userId,
      path: filePath,
      message: messageId,
      dmMessage: dmMessageId
    });
    
    await fileAttachment.save();
    return fileAttachment;
  } catch (err) {
    console.error('File upload error:', err);
    throw err;
  }
}

// Function to get file info
async function getFileInfo(fileId) {
  try {
    return await FileAttachment.findById(fileId).populate('uploader', 'username');
  } catch (err) {
    console.error('Get file info error:', err);
    throw err;
  }
}

// Function to delete a file
async function deleteFile(fileId) {
  try {
    const file = await FileAttachment.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }
    
    // Delete the file from disk
    const filePath = path.join(__dirname, '..', file.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete the record from the database
    await file.remove();
    return true;
  } catch (err) {
    console.error('Delete file error:', err);
    throw err;
  }
}

module.exports = {
  handleFileUpload,
  getFileInfo,
  deleteFile
};
