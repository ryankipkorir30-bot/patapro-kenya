const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const privateDirectory = path.resolve(
  __dirname,
  "../private-verifications"
);

fs.mkdirSync(privateDirectory, { recursive: true });

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, privateDirectory);
  },

  filename: (req, file, callback) => {
    const extensionByType = {
      "application/pdf": ".pdf",
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp"
    };

    const extension = extensionByType[file.mimetype];

    if (!extension) {
      return callback(new Error("Unsupported document type."));
    }

    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

function fileFilter(req, file, callback) {
  if (!allowedTypes.has(file.mimetype)) {
    return callback(
      new Error("Upload a PDF, JPEG, PNG, or WebP document.")
    );
  }

  callback(null, true);
}

const verificationUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});

module.exports = {
  verificationUpload,
  privateDirectory
};
