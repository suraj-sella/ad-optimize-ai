const Queue = require('bull');
const logger = require('../utils/logger');
const csvProcessor = require('./csvProcessor');
const db = require('../config/database');

class JobQueue {
  constructor() {
    this.analysisQueue = new Queue('csv-analysis', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined
      }
    });

    this.setupQueueHandlers();
  }

  /**
   * Setup queue event handlers
   */
  setupQueueHandlers() {
    // Job completed
    this.analysisQueue.on('completed', async (job, result) => {
      logger.info(`Job ${job.id} completed successfully`);
      await this.updateJobStatus(job.data.jobId, 'completed', 100, null, result);
    });

    // Job failed
    this.analysisQueue.on('failed', async (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
      await this.updateJobStatus(job.data.jobId, 'failed', 0, err.message);
    });

    // Job progress
    this.analysisQueue.on('progress', async (job, progress) => {
      logger.info(`Job ${job.id} progress: ${progress}%`);
      await this.updateJobProgress(job.data.jobId, progress);
    });

    // Process jobs
    this.analysisQueue.process('analyze-csv', async (job) => {
      return await this.processCSVJob(job);
    });
  }

  /**
   * Add a new CSV analysis job to the queue
   */
  async addAnalysisJob(jobData) {
    try {
      const job = await this.analysisQueue.add('analyze-csv', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5
      });

      logger.info(`Added analysis job ${job.id} to queue for file: ${jobData.filename}`);
      return job.id;
    } catch (error) {
      logger.error('Error adding job to queue:', error);
      throw error;
    }
  }

  /**
   * Process CSV analysis job
   */
  async processCSVJob(job) {
    const { jobId, filePath, filename } = job.data;
    
    try {
      logger.info(`Starting CSV analysis for job ${jobId}, file: ${filename}`);

      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing', 0);

      // Report progress
      job.progress(10);

      // Process CSV file
      const processedData = await csvProcessor.processCSV(filePath);
      
      job.progress(50);

      // Store processed data in database
      await this.storeProcessedData(jobId, processedData.data);
      
      job.progress(70);

      // Generate analysis
      const analysis = csvProcessor.generateAnalysis(processedData.data);
      
      job.progress(90);

      // Store analysis results
      await this.storeAnalysisResults(jobId, processedData, analysis);
      
      job.progress(100);

      logger.info(`CSV analysis completed for job ${jobId}`);

      return {
        success: true,
        processedRows: processedData.validRows,
        totalRows: processedData.totalRows,
        analysis: analysis
      };

    } catch (error) {
      logger.error(`Error processing CSV job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Update job status in database
   */
  async updateJobStatus(jobId, status, progress = null, errorMessage = null, result = null) {
    try {
      const updateFields = ['status = $1'];
      const values = [status];
      let paramIndex = 2;

      if (progress !== null) {
        updateFields.push(`progress = $${paramIndex++}`);
        values.push(progress);
      }

      if (errorMessage !== null) {
        updateFields.push(`error_message = $${paramIndex++}`);
        values.push(errorMessage);
      }

      if (status === 'completed' && result) {
        updateFields.push(`completed_at = CURRENT_TIMESTAMP`);
      }

      values.push(jobId);

      const query = `
        UPDATE analysis_jobs 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = $${paramIndex}
      `;

      await db.query(query, values);
      logger.info(`Updated job ${jobId} status to ${status}`);
    } catch (error) {
      logger.error(`Error updating job status for ${jobId}:`, error);
    }
  }

  /**
   * Update job progress in database
   */
  async updateJobProgress(jobId, progress) {
    try {
      const query = `
        UPDATE analysis_jobs 
        SET progress = $1, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = $2
      `;
      await db.query(query, [progress, jobId]);
    } catch (error) {
      logger.error(`Error updating job progress for ${jobId}:`, error);
    }
  }

  /**
   * Store processed data in database
   */
  async storeProcessedData(jobId, data) {
    try {
      // Get the analysis job ID
      const jobQuery = 'SELECT id FROM analysis_jobs WHERE job_id = $1';
      const jobResult = await db.query(jobQuery, [jobId]);
      
      if (jobResult.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const analysisJobId = jobResult.rows[0].id;

      // Store data in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        const values = batch.map((row, index) => {
          const baseIndex = index * 3;
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`;
        }).join(', ');

        const query = `
          INSERT INTO processed_data (job_id, row_data, metrics)
          VALUES ${values}
        `;

        const queryValues = batch.flatMap(row => [
          analysisJobId,
          JSON.stringify(row),
          JSON.stringify({
            calculated_ctr: row.calculated_ctr,
            calculated_cpc: row.calculated_cpc,
            calculated_cpm: row.calculated_cpm,
            calculated_roas: row.calculated_roas,
            calculated_acos: row.calculated_acos,
            calculated_conversion_rate: row.calculated_conversion_rate
          })
        ]);

        await db.query(query, queryValues);
      }

      logger.info(`Stored ${data.length} rows of processed data for job ${jobId}`);
    } catch (error) {
      logger.error(`Error storing processed data for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Store analysis results in database
   */
  async storeAnalysisResults(jobId, processedData, analysis) {
    try {
      // Get the analysis job ID
      const jobQuery = 'SELECT id FROM analysis_jobs WHERE job_id = $1';
      const jobResult = await db.query(jobQuery, [jobId]);
      
      if (jobResult.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const analysisJobId = jobResult.rows[0].id;

      const query = `
        INSERT INTO analysis_results 
        (job_id, total_rows, processed_rows, metrics_summary, top_performers, bottom_performers, trends)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const values = [
        analysisJobId,
        processedData.totalRows,
        processedData.validRows,
        JSON.stringify(analysis.summary),
        JSON.stringify(analysis.topPerformers),
        JSON.stringify(analysis.bottomPerformers),
        JSON.stringify(analysis.trends)
      ];

      await db.query(query, values);

      // Store recommendations as optimization tasks
      await this.storeOptimizationTasks(analysisJobId, analysis.recommendations);

      logger.info(`Stored analysis results for job ${jobId}`);
    } catch (error) {
      logger.error(`Error storing analysis results for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Store optimization tasks in database
   */
  async storeOptimizationTasks(analysisJobId, recommendations) {
    try {
      for (const recommendation of recommendations) {
        const query = `
          INSERT INTO optimization_tasks 
          (job_id, task_type, priority, description, action_items, estimated_impact)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        const values = [
          analysisJobId,
          recommendation.type,
          recommendation.priority,
          recommendation.description,
          JSON.stringify([]), // Will be populated by AI agents later
          recommendation.impact
        ];

        await db.query(query, values);
      }

      logger.info(`Stored ${recommendations.length} optimization tasks`);
    } catch (error) {
      logger.error('Error storing optimization tasks:', error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    try {
      const query = `
        SELECT 
          job_id,
          filename,
          status,
          progress,
          error_message,
          created_at,
          updated_at,
          completed_at
        FROM analysis_jobs 
        WHERE job_id = $1
      `;

      const result = await db.query(query, [jobId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error(`Error getting job status for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get analysis results
   */
  async getAnalysisResults(jobId) {
    try {
      // Get analysis results
      const analysisQuery = `
        SELECT 
          ar.total_rows,
          ar.processed_rows,
          ar.metrics_summary,
          ar.top_performers,
          ar.bottom_performers,
          ar.trends,
          ar.created_at
        FROM analysis_results ar
        JOIN analysis_jobs aj ON ar.job_id = aj.id
        WHERE aj.job_id = $1
      `;

      const analysisResult = await db.query(analysisQuery, [jobId]);

      if (analysisResult.rows.length === 0) {
        return null;
      }

      // Get optimization tasks
      const tasksQuery = `
        SELECT 
          task_type,
          priority,
          description,
          action_items,
          estimated_impact,
          status,
          created_at
        FROM optimization_tasks ot
        JOIN analysis_jobs aj ON ot.job_id = aj.id
        WHERE aj.job_id = $1
        ORDER BY 
          CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
          END,
          created_at
      `;

      const tasksResult = await db.query(tasksQuery, [jobId]);

      return {
        analysis: analysisResult.rows[0],
        optimizationTasks: tasksResult.rows
      };
    } catch (error) {
      logger.error(`Error getting analysis results for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up completed jobs
   */
  async cleanupOldJobs(daysOld = 30) {
    try {
      const query = `
        DELETE FROM analysis_jobs 
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
        AND status IN ('completed', 'failed')
      `;

      const result = await db.query(query);
      logger.info(`Cleaned up ${result.rowCount} old jobs`);
    } catch (error) {
      logger.error('Error cleaning up old jobs:', error);
    }
  }
}

module.exports = new JobQueue(); 