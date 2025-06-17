const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Validation schemas
 */
const schemas = {
  // File upload validation
  uploadFile: Joi.object({
    file: Joi.object({
      originalname: Joi.string().required(),
      mimetype: Joi.string().valid('text/csv', 'application/csv').required(),
      size: Joi.number().max(parseInt(process.env.MAX_FILE_SIZE) || 104857600).required()
    }).required()
  }),

  // Job ID validation
  jobId: Joi.object({
    id: Joi.string().uuid().required()
  }),

  // Optimization request validation
  optimizeRequest: Joi.object({
    priority: Joi.string().valid('high', 'medium', 'low').optional(),
    focus_areas: Joi.array().items(Joi.string()).optional()
  })
};

/**
 * Generic validation middleware
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property]);
    
    if (error) {
      logger.warn(`Validation error: ${error.details[0].message}`);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    // Replace validated data
    req[property] = value;
    next();
  };
};

/**
 * File upload validation middleware
 */
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  const { error } = schemas.uploadFile.validate({ file: req.file });
  
  if (error) {
    logger.warn(`File validation error: ${error.details[0].message}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid file',
      details: error.details[0].message
    });
  }

  next();
};

/**
 * Job ID validation middleware
 */
const validateJobId = (req, res, next) => {
  const { error } = schemas.jobId.validate({ id: req.params.id });
  
  if (error) {
    logger.warn(`Job ID validation error: ${error.details[0].message}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid job ID',
      details: error.details[0].message
    });
  }

  next();
};

/**
 * Sanitize file data
 */
const sanitizeFileData = (req, res, next) => {
  if (req.file) {
    // Sanitize filename
    req.file.originalname = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Ensure file extension is .csv
    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      req.file.originalname += '.csv';
    }
  }
  
  next();
};

/**
 * Rate limiting validation
 */
const validateRateLimit = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  // Log request for monitoring
  logger.info(`Request from ${clientIP} - ${req.method} ${req.path} - ${userAgent}`);
  
  next();
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', err);

  // Handle specific error types
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large',
      details: 'File size exceeds maximum allowed limit'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field',
      details: 'Please use the correct field name for file upload'
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

module.exports = {
  validate,
  validateFileUpload,
  validateJobId,
  sanitizeFileData,
  validateRateLimit,
  errorHandler,
  requestLogger,
  schemas
}; 