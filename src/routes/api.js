const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const uploadController = require("../controllers/uploadController");
const analysisController = require("../controllers/analysisController");
const {
  validateFileUpload,
  validateJobId,
  sanitizeFileData,
  validateRateLimit,
  errorHandler,
  requestLogger,
} = require("../middleware/validation");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate temporary filename, will be renamed after validation
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "temp-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB default
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype === "text/csv" || file.mimetype === "application/csv") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
});

// Apply middleware to all routes
router.use(requestLogger);
router.use(validateRateLimit);

/**
 * @route   POST /api/upload
 * @desc    Upload CSV file for analysis
 * @access  Public
 */
router.post(
  "/upload",
  upload.single("file"),
  validateFileUpload,
  sanitizeFileData,
  uploadController.uploadFile
);

/**
 * @route   GET /api/uploads
 * @desc    List all uploads with pagination
 * @access  Public
 */
router.get("/uploads", uploadController.listUploads);

/**
 * @route   GET /api/upload/stats
 * @desc    Get upload statistics
 * @access  Public
 */
router.get("/upload/stats", uploadController.getUploadStats);

/**
 * @route   GET /api/upload/:id
 * @desc    Get upload status
 * @access  Public
 */
router.get("/upload/:id", validateJobId, uploadController.getUploadStatus);

/**
 * @route   DELETE /api/upload/:id
 * @desc    Delete upload and associated data
 * @access  Public
 */
router.delete("/upload/:id", validateJobId, uploadController.deleteUpload);

/**
 * @route   GET /api/analysis/stats
 * @desc    Get analysis statistics
 * @access  Public
 */
router.get("/analysis/stats", analysisController.getAnalysisStats);

/**
 * @route   GET /api/analysis/:id
 * @desc    Get analysis results for a job
 * @access  Public
 */
router.get("/analysis/:id", validateJobId, analysisController.getAnalysis);

/**
 * @route   POST /api/optimize/:id
 * @desc    Generate optimization strategies for a completed analysis
 * @access  Public
 */
router.post(
  "/optimize/:id",
  validateJobId,
  analysisController.generateOptimization
);

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get("/health", (req, res) => {
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? `${req.protocol}://${req.headers.host}`
      : `http://localhost:${process.env.PORT || 3000}`;
  res.json({
    success: true,
    message: "Ad Optimize AI Backend is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    baseUrl,
    documentation: `${baseUrl}/api/info`,
  });
});

/**
 * @route   GET /api/info
 * @desc    API information and documentation
 * @access  Public
 */
router.get("/info", (req, res) => {
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? `${req.protocol}://${req.headers.host}`
      : `http://localhost:${process.env.PORT || 3000}`;
  res.json({
    success: true,
    data: {
      name: "Ad Optimize AI Backend API",
      version: "1.0.0",
      description: "Backend API for AI-powered ad optimization platform",
      baseUrl,
      endpoints: {
        upload: {
          "POST /api/upload": "Upload CSV file for analysis",
          "GET /api/upload/:id": "Get upload status",
          "GET /api/uploads": "List all uploads",
          "DELETE /api/upload/:id": "Delete upload",
          "GET /api/upload/stats": "Get upload statistics",
        },
        analysis: {
          "GET /api/analysis/:id": "Get analysis results",
          "POST /api/optimize/:id": "Generate optimization strategies",
          "GET /api/analysis/stats": "Get analysis statistics",
        },
        system: {
          "GET /api/health": "Health check",
          "GET /api/info": "API information",
        },
      },
      fileUpload: {
        maxSize: "100MB",
        supportedFormats: ["CSV"],
        fieldName: "file",
      },
      responseFormat: {
        success: "boolean",
        message: "string (optional)",
        data: "object (optional)",
        error: "string (on error)",
        details: "string (on error)",
      },
    },
  });
});

// Error handling middleware
router.use(errorHandler);

module.exports = router;
