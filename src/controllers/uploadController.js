const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const db = require('../config/database');
const jobQueue = require('../services/jobQueue');

class UploadController {
  /**
   * Handle CSV file upload
   */
  async uploadFile(req, res) {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Generate unique job ID
      const jobId = uuidv4();
      
      // Create uploads directory if it doesn't exist
      const uploadDir = process.env.UPLOAD_PATH || './uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${timestamp}_${jobId}${fileExtension}`;
      const filePath = path.join(uploadDir, uniqueFilename);

      // Move file to uploads directory
      fs.renameSync(file.path, filePath);

      // Store job metadata in database
      await this.createJobRecord(jobId, file.originalname, filePath, file.size);

      // Add job to processing queue
      const queueJobId = await jobQueue.addAnalysisJob({
        jobId,
        filePath,
        filename: file.originalname
      });

      logger.info(`File upload successful. Job ID: ${jobId}, Queue Job ID: ${queueJobId}`);

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          jobId,
          filename: file.originalname,
          fileSize: file.size,
          status: 'pending',
          estimatedProcessingTime: '2-5 minutes'
        }
      });

    } catch (error) {
      logger.error('Error in file upload:', error);
      
      // Clean up uploaded file if it exists
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to upload file',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Create job record in database
   */
  async createJobRecord(jobId, filename, filePath, fileSize) {
    try {
      const query = `
        INSERT INTO analysis_jobs (job_id, filename, file_path, file_size, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id
      `;

      const result = await db.query(query, [jobId, filename, filePath, fileSize]);
      
      logger.info(`Created job record with ID: ${result.rows[0].id}`);
      return result.rows[0].id;
    } catch (error) {
      logger.error('Error creating job record:', error);
      throw error;
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(req, res) {
    try {
      const { jobId } = req.params;

      const jobStatus = await jobQueue.getJobStatus(jobId);

      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      res.json({
        success: true,
        data: {
          jobId: jobStatus.job_id,
          filename: jobStatus.filename,
          status: jobStatus.status,
          progress: jobStatus.progress,
          errorMessage: jobStatus.error_message,
          createdAt: jobStatus.created_at,
          updatedAt: jobStatus.updated_at,
          completedAt: jobStatus.completed_at
        }
      });

    } catch (error) {
      logger.error('Error getting upload status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get upload status',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * List all uploads
   */
  async listUploads(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          job_id,
          filename,
          file_size,
          status,
          progress,
          created_at,
          updated_at,
          completed_at
        FROM analysis_jobs
      `;

      const queryParams = [];
      let paramIndex = 1;

      if (status) {
        query += ` WHERE status = $${paramIndex++}`;
        queryParams.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      queryParams.push(parseInt(limit), offset);

      const result = await db.query(query, queryParams);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM analysis_jobs';
      if (status) {
        countQuery += ' WHERE status = $1';
      }
      const countResult = await db.query(countQuery, status ? [status] : []);

      res.json({
        success: true,
        data: {
          uploads: result.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(countResult.rows[0].count),
            totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Error listing uploads:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list uploads',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Delete upload and associated data
   */
  async deleteUpload(req, res) {
    try {
      const { jobId } = req.params;

      // Get job details
      const jobQuery = 'SELECT file_path FROM analysis_jobs WHERE job_id = $1';
      const jobResult = await db.query(jobQuery, [jobId]);

      if (jobResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      const filePath = jobResult.rows[0].file_path;

      // Delete file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted file: ${filePath}`);
      }

      // Delete job and associated data (cascade will handle related records)
      const deleteQuery = 'DELETE FROM analysis_jobs WHERE job_id = $1';
      await db.query(deleteQuery, [jobId]);

      logger.info(`Deleted job and associated data for job ID: ${jobId}`);

      res.json({
        success: true,
        message: 'Upload deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete upload',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get upload statistics
   */
  async getUploadStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time
        FROM analysis_jobs 
        GROUP BY status
      `;

      const result = await db.query(statsQuery);

      const stats = {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        avgProcessingTime: 0
      };

      let totalProcessingTime = 0;
      let completedCount = 0;

      result.rows.forEach(row => {
        stats[row.status] = parseInt(row.count);
        stats.total += parseInt(row.count);
        
        if (row.status === 'completed' && row.avg_processing_time) {
          totalProcessingTime += parseFloat(row.avg_processing_time);
          completedCount += parseInt(row.count);
        }
      });

      if (completedCount > 0) {
        stats.avgProcessingTime = Math.round(totalProcessingTime / completedCount);
      }

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting upload stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get upload statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new UploadController(); 