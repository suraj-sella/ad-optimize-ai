const Queue = require("bull");
const logger = require("../utils/logger");
const csvProcessor = require("./csvProcessor");
const db = require("../config/database");
const { runAgentPipeline } = require("./langchain/agents/orchestrator");

class JobQueue {
  constructor() {
    this.analysisQueue = new Queue("csv-analysis", {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
      },
    });

    this.setupQueueHandlers();
  }

  /**
   * Setup queue event handlers
   */
  setupQueueHandlers() {
    // Job completed
    this.analysisQueue.on("completed", async (job, result) => {
      logger.info(`Job ${job.id} completed successfully`);
      await this.updateJobStatus(
        job.data.jobId,
        "completed",
        100,
        null,
        result
      );
    });

    // Job failed
    this.analysisQueue.on("failed", async (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
      await this.updateJobStatus(job.data.jobId, "failed", 0, err.message);
    });

    // Job progress
    this.analysisQueue.on("progress", async (job, progress) => {
      logger.info(`Job ${job.id} progress: ${progress}%`);
      await this.updateJobProgress(job.data.jobId, progress);
    });

    // Process jobs
    this.analysisQueue.process("analyze-csv", async (job) => {
      // await new Promise((resolve) => setTimeout(resolve, 5000));
      return await this.processCSVJob(job);
    });
  }

  /**
   * Add a new CSV analysis job to the queue
   */
  async addAnalysisJob(jobData) {
    try {
      const job = await this.analysisQueue.add("analyze-csv", jobData, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      logger.info(
        `Added analysis job ${job.id} to queue for file: ${jobData.filename}`
      );
      return job.id;
    } catch (error) {
      logger.error("Error adding job to queue:", error);
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
      await this.updateJobStatus(
        jobId,
        "processing",
        0,
        null,
        null,
        "Starting analysis"
      );

      // Report progress
      job.progress(10);
      await this.updateJobProgress(jobId, 10, "Processing CSV file");

      // Parse and validate CSV file
      const processedData = await csvProcessor.processCSV(filePath);

      job.progress(50);
      await this.updateJobProgress(jobId, 50, "Running agent pipeline");

      // Run orchestrator pipeline (agents)
      const agentOutput = await runAgentPipeline(processedData.data);
      // agentOutput: { analysis, insights, tasks, aiGenerated }

      job.progress(80);
      await this.updateJobProgress(jobId, 80, "Storing analysis results");

      // Store orchestrator output in database (analysis, insights, tasks)
      await this.storeAnalysisResults(jobId, processedData, agentOutput);

      job.progress(90);
      await this.updateJobProgress(jobId, 90, "Storing historical data");

      // Store historical data for trend analysis (use summary from agentOutput.analysis if available)
      await this.storeHistoricalData(jobId, {
        date_range: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
        performance_metrics:
          agentOutput.analysis?.metrics || agentOutput.analysis?.summary || {},
      });

      logger.info(`CSV analysis completed for job ${jobId}`);
      job.progress(100);
      await this.updateJobProgress(jobId, 100, "Analysis complete");

      return {
        success: true,
        processedRows: processedData.validRows,
        totalRows: processedData.totalRows,
        analysis: agentOutput.analysis,
        insights: agentOutput.insights,
        tasks: agentOutput.tasks,
        aiGenerated: agentOutput.aiGenerated,
      };
    } catch (error) {
      logger.error(`Error processing CSV job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Update job status in database
   */
  async updateJobStatus(
    jobId,
    status,
    progress = null,
    errorMessage = null,
    result = null,
    message = null
  ) {
    try {
      const updateFields = ["status = $1"];
      const values = [status];
      let paramIndex = 2;

      if (progress !== null) {
        updateFields.push(`progress = $${paramIndex++}`);
        values.push(progress);
      }

      if (message !== null) {
        updateFields.push(`message = $${paramIndex++}`);
        values.push(message);
      }

      if (errorMessage !== null) {
        updateFields.push(`error_message = $${paramIndex++}`);
        values.push(errorMessage);
      }

      if (status === "completed" && result) {
        updateFields.push(`completed_at = CURRENT_TIMESTAMP`);
      }

      values.push(jobId);

      const query = `
        UPDATE analysis_jobs 
        SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
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
  async updateJobProgress(jobId, progress, message = null) {
    try {
      let query, params;
      if (message !== null) {
        query = `
          UPDATE analysis_jobs 
          SET progress = $1, message = $2, updated_at = CURRENT_TIMESTAMP
          WHERE job_id = $3
        `;
        params = [progress, message, jobId];
      } else {
        query = `
          UPDATE analysis_jobs 
          SET progress = $1, updated_at = CURRENT_TIMESTAMP
          WHERE job_id = $2
        `;
        params = [progress, jobId];
      }
      await db.query(query, params);
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
      const jobQuery = "SELECT id FROM analysis_jobs WHERE job_id = $1";
      const jobResult = await db.query(jobQuery, [jobId]);

      if (jobResult.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const analysisJobId = jobResult.rows[0].id;

      // Store data in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const values = batch
          .map((row, index) => {
            const baseIndex = index * 3;
            return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`;
          })
          .join(", ");

        const query = `
          INSERT INTO processed_data (job_id, row_data, metrics)
          VALUES ${values}
        `;

        const queryValues = batch.flatMap((row) => [
          analysisJobId,
          JSON.stringify(row),
          JSON.stringify({
            calculated_ctr: row.calculated_ctr,
            calculated_cpc: row.calculated_cpc,
            calculated_cpm: row.calculated_cpm,
            calculated_roas: row.calculated_roas,
            calculated_acos: row.calculated_acos,
            calculated_conversion_rate: row.calculated_conversion_rate,
          }),
        ]);

        await db.query(query, queryValues);
      }

      logger.info(
        `Stored ${data.length} rows of processed data for job ${jobId}`
      );
    } catch (error) {
      logger.error(`Error storing processed data for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Store analysis results in database
   */
  async storeAnalysisResults(jobId, processedData, agentOutput) {
    try {
      // Get the analysis job ID
      const jobQuery = "SELECT id FROM analysis_jobs WHERE job_id = $1";
      const jobResult = await db.query(jobQuery, [jobId]);

      if (jobResult.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const analysisJobId = jobResult.rows[0].id;

      // Insert orchestrator output (analysis, insights, tasks) into analysis_results
      const query = `
        INSERT INTO analysis_results 
        (job_id, total_rows, processed_rows, metrics_summary, top_performers, bottom_performers, trends, insights, tasks)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const analysis = agentOutput.analysis || {};
      const values = [
        analysisJobId,
        processedData.totalRows,
        processedData.validRows,
        JSON.stringify(analysis.summary || analysis.metrics || {}),
        JSON.stringify(
          analysis.topPerformers || analysis.top_performers || null
        ),
        JSON.stringify(
          analysis.bottomPerformers || analysis.bottom_performers || null
        ),
        JSON.stringify(analysis.trends || null),
        agentOutput.insights ? JSON.stringify(agentOutput.insights) : null,
        agentOutput.tasks ? JSON.stringify(agentOutput.tasks) : null,
      ];

      await db.query(query, values);

      // Store recommendations as optimization tasks (if present)
      if (agentOutput.tasks) {
        await this.updateOptimizationTasks(jobId, agentOutput.tasks.tasks);
      }

      logger.info(`Stored orchestrator analysis results for job ${jobId}`);
    } catch (error) {
      logger.error(
        `Error storing orchestrator analysis results for job ${jobId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update optimization tasks in database
   */
  async updateOptimizationTasks(jobId, tasks) {
    try {
      // Get the internal UUID for this job
      const jobQuery = "SELECT id FROM analysis_jobs WHERE job_id = $1";
      const jobResult = await db.query(jobQuery, [jobId]);
      if (jobResult.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }
      const analysisJobId = jobResult.rows[0].id;

      // Delete existing tasks
      await db.query("DELETE FROM optimization_tasks WHERE job_id = $1", [
        analysisJobId,
      ]);

      // Insert new tasks
      for (const task of tasks) {
        const query = `
          INSERT INTO optimization_tasks 
          (job_id, task_type, priority, description, estimated_impact, difficulty, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        const values = [
          analysisJobId, // use the internal UUID here
          task.type,
          task.priority,
          task.description,
          task.impact || task.estimated_impact || null,
          task.difficulty || null,
          "pending",
        ];
        await db.query(query, values);
      }
      logger.info(
        `Updated ${tasks.length} optimization tasks for job ${jobId}`
      );
    } catch (error) {
      logger.error("Error updating optimization tasks:", error);
      throw error;
    }
  }

  /**
   * Store historical data in database
   */
  async storeHistoricalData(jobId, historicalData) {
    try {
      const jobQuery = "SELECT id FROM analysis_jobs WHERE job_id = $1";
      const jobResult = await db.query(jobQuery, [jobId]);

      if (jobResult.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const analysisJobId = jobResult.rows[0].id;

      const query = `
        INSERT INTO historical_data (job_id, date_range, performance_metrics)
        VALUES ($1, $2, $3)
      `;

      const values = [
        analysisJobId,
        JSON.stringify(historicalData.date_range),
        JSON.stringify(historicalData.performance_metrics),
      ];

      await db.query(query, values);
      logger.info(`Stored historical data for job ${jobId}`);
    } catch (error) {
      logger.error(`Error storing historical data for job ${jobId}:`, error);
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
          message,
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
   * Get analysis results along with associated optimization tasks
   */
  async getAnalysisResults(jobId) {
    try {
      const query = `
        SELECT
          aj.status,
          ar.total_rows,
          ar.processed_rows,
          ar.metrics_summary,
          ar.top_performers,
          ar.bottom_performers,
          ar.trends,
          ar.insights,
          ar.tasks,
          ot.task_type,
          ot.priority,
          ot.description,
          ot.estimated_impact,
          ot.difficulty,
          ot.status as optimization_status
        FROM analysis_jobs aj
        LEFT JOIN analysis_results ar ON aj.id = ar.job_id
        LEFT JOIN optimization_tasks ot ON aj.id = ot.job_id
        WHERE aj.job_id = $1
      `;

      const result = await db.query(query, [jobId]);

      if (result.rows.length === 0) {
        return null; // Analysis results not found
      }

      // Group optimization tasks by analysis job
      const analysisData = {
        analysis: {
          total_rows: result.rows[0].total_rows,
          processed_rows: result.rows[0].processed_rows,
          metrics_summary: result.rows[0].metrics_summary,
          top_performers: result.rows[0].top_performers,
          bottom_performers: result.rows[0].bottom_performers,
          trends: result.rows[0].trends,
          insights: result.rows[0].insights,
          tasks: result.rows[0].tasks,
          status: result.rows[0].status,
        },
        optimizationTasks: [],
      };

      result.rows.forEach((row) => {
        if (row.task_type) {
          analysisData.optimizationTasks.push({
            task_type: row.task_type,
            priority: row.priority,
            description: row.description,
            estimated_impact: row.estimated_impact,
            difficulty: row.difficulty,
            status: row.optimization_status, // Use the aliased status here
          });
        }
      });

      return analysisData;
    } catch (error) {
      logger.error(`Error getting analysis results for job ${jobId}:`, error);
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
      logger.error("Error cleaning up old jobs:", error);
    }
  }

  /**
   * Remove a job from the queue by jobId (if it exists and is not completed)
   */
  async removeJob(jobId) {
    try {
      // Bull job IDs are numeric, but we use our own jobId as job.data.jobId
      const jobs = await this.analysisQueue.getJobs([
        "waiting",
        "active",
        "delayed",
        "paused",
      ]);
      for (const job of jobs) {
        if (job.data && job.data.jobId === jobId) {
          await job.remove();
          logger.info(`Removed job ${jobId} from queue`);
          return true;
        }
      }
      logger.info(
        `No active queue job found for jobId ${jobId} (may already be processed or removed)`
      );
      return false;
    } catch (error) {
      logger.error(`Error removing job ${jobId} from queue:`, error);
      return false;
    }
  }
}

module.exports = new JobQueue();
