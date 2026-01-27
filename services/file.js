const path = require("path");
const fs = require("fs");

/**
 * Reads a file at the given path and returns a promise that resolves with an object containing the file data and its size.
 *
 * @param {string} filePath - The path to the file to read.
 * @returns {Promise<{data: Buffer, size: number}>} - A promise that resolves with an object containing the file data and its size.
 */
async function getFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const stats = fs.statSync(filePath);
        resolve({ data, size: stats.size || 0 });
      }
    });
  });
}

module.exports = {
  getFile,
};
