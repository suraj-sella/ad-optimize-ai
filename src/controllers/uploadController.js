const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");
const db = require("../config/database");
const jobQueue = require("../services/jobQueue");

class UploadController {
  /**
   * Handle CSV file upload
   */
  uploadFile = async (req, res) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      // Generate unique job ID
      const jobId = uuidv4();

      // Create uploads directory if it doesn't exist
      const uploadDir = process.env.UPLOAD_PATH || "./uploads";
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
        filename: file.originalname,
      });

      logger.info(
        `File upload successful. Job ID: ${jobId}, Queue Job ID: ${queueJobId}`
      );

      res.status(201).json({
        success: true,
        message: "File uploaded successfully",
        data: {
          jobId,
          filename: file.originalname,
          fileSize: file.size,
          status: "pending",
          estimatedProcessingTime: "2-5 minutes",
        },
      });
    } catch (error) {
      logger.error("Error in file upload:", error);

      // Clean up uploaded file if it exists
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: "Failed to upload file",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  };

  /**
   * Create job record in database
   */
  createJobRecord = async (jobId, filename, filePath, fileSize) => {
    try {
      const query = `
        INSERT INTO analysis_jobs (job_id, filename, file_path, file_size, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id
      `;

      const result = await db.query(query, [
        jobId,
        filename,
        filePath,
        fileSize,
      ]);

      logger.info(`Created job record with ID: ${result.rows[0].id}`);
      return result.rows[0].id;
    } catch (error) {
      logger.error("Error creating job record:", error);
      throw error;
    }
  };

  /**
   * Get upload status
   */
  getUploadStatus = async (req, res) => {
    try {
      const { id } = req.params;

      const jobStatus = await jobQueue.getJobStatus(id);

      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: "Job not found",
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
          completedAt: jobStatus.completed_at,
        },
      });
    } catch (error) {
      logger.error("Error getting upload status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get upload status",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  };

  /**
   * List all uploads
   */
  listUploads = async (req, res) => {
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
      let countQuery = "SELECT COUNT(*) FROM analysis_jobs";
      if (status) {
        countQuery += " WHERE status = $1";
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
            totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
          },
        },
      });
    } catch (error) {
      logger.error("Error listing uploads:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list uploads",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  };

  /**
   * Delete upload and associated data
   */
  deleteUpload = async (req, res) => {
    try {
      console.log(req.params);
      const { id } = req.params;

      // Delete job record from database
      const deleteJobQuery =
        "DELETE FROM analysis_jobs WHERE job_id = $1 RETURNING file_path";
      const jobResult = await db.query(deleteJobQuery, [id]);

      if (jobResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Job not found",
          message: "No upload found with the provided ID.",
        });
      }

      const filePath = jobResult.rows[0].file_path;

      // Remove file from uploads directory
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted file: ${filePath}`);
      }

      // Remove job from queue (if still pending/active)
      await jobQueue.removeJob(id);

      logger.info(`Upload and associated data deleted for Job ID: ${id}`);

      res.json({
        success: true,
        message: "Upload and associated data deleted successfully.",
        data: { id },
      });
    } catch (error) {
      logger.error("Error deleting upload:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete upload",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  };

  /**
   * Get upload statistics
   */
  getUploadStats = async (req, res) => {
    try {
      const totalUploadsResult = await db.query(
        "SELECT COUNT(*) FROM analysis_jobs"
      );
      const processingUploadsResult = await db.query(
        "SELECT COUNT(*) FROM analysis_jobs WHERE status = 'pending' OR status = 'processing'"
      );
      const completedUploadsResult = await db.query(
        "SELECT COUNT(*) FROM analysis_jobs WHERE status = 'completed'"
      );
      const failedUploadsResult = await db.query(
        "SELECT COUNT(*) FROM analysis_jobs WHERE status = 'failed'"
      );

      res.json({
        success: true,
        data: {
          totalUploads: parseInt(totalUploadsResult.rows[0].count),
          processingUploads: parseInt(processingUploadsResult.rows[0].count),
          completedUploads: parseInt(completedUploadsResult.rows[0].count),
          failedUploads: parseInt(failedUploadsResult.rows[0].count),
        },
      });
    } catch (error) {
      logger.error("Error getting upload statistics:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get upload statistics",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  };
}

module.exports = new UploadController();
