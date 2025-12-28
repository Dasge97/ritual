const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");

const { asyncHandler } = require("../middleware/asyncHandler");
const { register, login, me } = require("../controllers/authController");

const router = express.Router();

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "..", "uploads");
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch {
      // Ignorar.
    }
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeBase = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "");
    cb(null, `${safeBase}${ext}`);
  }
});
const allowedExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!file.mimetype?.startsWith("image/") || !allowedExt.has(ext)) {
      const err = new Error("Invalid avatar file type");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  }
});

const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });

router.post("/register", registerLimiter, upload.single("avatar"), asyncHandler(register));
router.post("/login", loginLimiter, asyncHandler(login));
router.get("/me", asyncHandler(me));

module.exports = router;
