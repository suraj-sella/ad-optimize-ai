const logger = require('../utils/logger');
const jobQueue = require('../services/jobQueue');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { runAgentPipeline } = require('../services/langchain/agents/orchestrator');
const { getJSON, setJSON } = require('../utils/redisClient');

class AnalysisController {
  /**
   * Get analysis results for a specific job
   */
  getAnalysis = async (req, res) => {
    try {
      const { id } = req.params;

      // Check cache first
      const cacheKey = `analysis:${id}`;
      const cached = await getJSON(cacheKey);
      if (cached) {
        logger.info(`Cache hit for analysis:${id}`);
        return res.json({ success: true, data: cached });
      }

      // Get job status first
      const jobStatus = await jobQueue.getJobStatus(id);

      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found'
        });
      }

      // If job is still processing, return status
      if (jobStatus.status === 'pending' || jobStatus.status === 'processing') {
        return res.json({
          success: true,
          data: {
            jobId: jobStatus.job_id,
            filename: jobStatus.filename,
            status: jobStatus.status,
            progress: jobStatus.progress,
            message: 'Analysis is still in progress'
          }
        });
      }

      // If job failed, return error
      if (jobStatus.status === 'failed') {
        return res.status(400).json({
          success: false,
          error: 'Analysis failed',
          details: jobStatus.error_message
        });
      }

      // Get analysis results
      const analysisResults = await jobQueue.getAnalysisResults(id);

      if (!analysisResults) {
        return res.status(404).json({
          success: false,
          error: 'Analysis results not found'
        });
      }

      // Format the response
      const formattedResults = this.formatAnalysisResults(analysisResults);

      // Cache the completed analysis result
      if (jobStatus.status === 'completed') {
        await setJSON(cacheKey, {
          jobId: jobStatus.job_id,
          filename: jobStatus.filename,
          status: jobStatus.status,
          completedAt: jobStatus.completed_at,
          analysis: formattedResults
        }, 3600); // 1 hour TTL
        logger.info(`Cached analysis:${id}`);
      }

      res.json({
        success: true,
        data: {
          jobId: jobStatus.job_id,
          filename: jobStatus.filename,
          status: jobStatus.status,
          completedAt: jobStatus.completed_at,
          analysis: formattedResults
        }
      });

    } catch (error) {
      logger.error('Error getting analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis results',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Format analysis results for API response
   */
  formatAnalysisResults = (results) => {
    const { analysis, optimizationTasks } = results;

    return {
      summary: {
        totalRows: analysis.total_rows,
        processedRows: analysis.processed_rows,
        successRate: ((analysis.processed_rows / analysis.total_rows) * 100).toFixed(2) + '%',
        metrics: analysis.metrics_summary
      },
      performance: {
        topPerformers: analysis.top_performers,
        bottomPerformers: analysis.bottom_performers
      },
      trends: analysis.trends,
      optimizationTasks: optimizationTasks.map(task => ({
        type: task.task_type,
        priority: task.priority,
        description: task.description,
        actionItems: task.action_items,
        estimatedImpact: task.estimated_impact,
        status: task.status
      }))
    };
  };

  /**
   * Generate optimization strategies
   */
  generateOptimization = async (req, res) => {
    try {
      const { id } = req.params;
      const { priority, focus_areas } = req.body;

      // Get job status
      const jobStatus = await jobQueue.getJobStatus(id);

      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      if (jobStatus.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Analysis must be completed before generating optimization strategies'
        });
      }

      // Get analysis data for the job
      const analysisResults = await jobQueue.getAnalysisResults(id);
      if (!analysisResults || !analysisResults.analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis results not found for optimization'
        });
      }

      // Run the multi-agent pipeline
      const agentOutput = await runAgentPipeline(analysisResults.analysis);
      const agentTasks = (agentOutput.tasks && agentOutput.tasks.tasks) ? agentOutput.tasks.tasks : [];

      // Update optimization tasks in database
      await this.updateOptimizationTasks(id, agentTasks);

      logger.info(`Generated optimization strategies for job ${id} using multi-agent pipeline`);

      res.json({
        success: true,
        message: 'Optimization strategies generated successfully',
        data: {
          jobId: id,
          totalTasks: agentTasks.length,
          tasks: agentTasks
        }
      });

    } catch (error) {
      logger.error('Error generating optimization:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate optimization strategies',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  /**
   * Get optimization tasks for a job
   */
  getOptimizationTasks = async (jobId) => {
    try {
      const query = `
        SELECT 
          task_type,
          priority,
          description,
          action_items,
          estimated_impact,
          ot.status
        FROM optimization_tasks ot
        JOIN analysis_jobs aj ON ot.job_id = aj.id
        WHERE aj.job_id = $1
        ORDER BY 
          CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
          END,
          ot.created_at
      `;

      const result = await db.query(query, [jobId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting optimization tasks:', error);
      throw error;
    }
  };

  /**
   * Enhance optimization tasks with more detailed strategies
   */
  enhanceOptimizationTasks = async (tasks, priority, focus_areas) => {
    // This is a placeholder for actual AI/LangChain logic
    // For now, it simply adds a generic action item to existing tasks
    // In a real scenario, this would involve complex AI processing

    logger.info('Enhancing optimization tasks...');

    const enhanced = tasks.map(task => ({
      ...task,
      actionItems: [
        ...(task.actionItems || []),
        {
          id: uuidv4(),
          description: 'Review detailed performance report for further insights.',
          status: 'pending',
          generated_at: new Date().toISOString()
        }
      ]
    }));

    return enhanced;
  };

  /**
   * Generate detailed action items for a task
   */
  generateActionItems = (task) => {
    // Placeholder for AI logic to generate specific action items
    const items = [
      'Analyze keyword relevance and remove underperforming terms.',
      'Adjust bid strategies for high-converting keywords.',
      'Expand audience targeting based on demographic insights.',
      'Optimize ad copy for higher click-through rates.',
      'Implement negative keywords to reduce irrelevant impressions.',
    ];
    return items.map(item => ({
      id: uuidv4(),
      description: item,
      status: 'pending',
      generated_at: new Date().toISOString()
    }));
  };

  /**
   * Estimate effort for a task based on priority
   */
  estimateEffort = (priority) => {
    switch (priority) {
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return 'Medium';
    }
  };

  /**
   * Estimate ROI for a task based on impact
   */
  estimateROI = (impact) => {
    switch (impact) {
      case 'High': return 'Significant ROI potential';
      case 'Medium': return 'Moderate ROI potential';
      case 'Low': return 'Limited ROI potential';
      default: return 'Uncertain ROI';
    }
  };

  /**
   * Estimate timeline for a task based on priority
   */
  estimateTimeline = (priority) => {
    switch (priority) {
      case 'high': return '1-3 days';
      case 'medium': return '3-7 days';
      case 'low': return '1-2 weeks';
      default: return '1 week';
    }
  };

  /**
   * Update optimization tasks in database
   */
  updateOptimizationTasks = async (jobId, enhancedTasks) => {
    try {
      const jobQuery = 'SELECT id FROM analysis_jobs WHERE job_id = $1';
      const jobResult = await db.query(jobQuery, [jobId]);

      if (jobResult.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const analysisJobId = jobResult.rows[0].id;

      // Clear existing tasks for this job
      await db.query('DELETE FROM optimization_tasks WHERE job_id = $1', [analysisJobId]);

      // Insert new tasks
      if (enhancedTasks.length > 0) {
        const values = enhancedTasks.map((task, index) => {
          const baseIndex = index * 7; // 7 columns per task
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`;
        }).join(', ');

        const query = `
          INSERT INTO optimization_tasks 
          (job_id, task_type, priority, description, action_items, estimated_impact, status)
          VALUES ${values}
        `;

        const queryValues = enhancedTasks.flatMap(task => [
          analysisJobId,
          task.type,
          task.priority,
          task.description,
          JSON.stringify(task.actionItems),
          task.estimatedImpact || null,
          task.status || 'pending',
        ]);
        await db.query(query, queryValues);
      }

      logger.info(`Updated ${enhancedTasks.length} optimization tasks for job ${jobId}`);
    } catch (error) {
      logger.error(`Error updating optimization tasks for job ${jobId}:`, error);
      throw error;
    }
  };

  /**
   * Get analysis statistics
   */
  getAnalysisStats = async (req, res) => {
    try {
      const totalAnalysisResult = await db.query('SELECT COUNT(*) FROM analysis_jobs WHERE status = \'completed\' OR status = \'failed\'');
      const avgProcessingTimeResult = await db.query('SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FROM analysis_jobs WHERE status = \'completed\'');
      const topPerformingKeywordsResult = await db.query('SELECT metrics_summary->\'topKeywords\' FROM analysis_results ORDER BY created_at DESC LIMIT 1');

      res.json({
        success: true,
        data: {
          totalAnalysis: parseInt(totalAnalysisResult.rows[0].count),
          averageProcessingTime: avgProcessingTimeResult.rows[0].avg || 0,
          topPerformingKeywords: topPerformingKeywordsResult.rows[0].topKeywords || [],
        }
      });

    } catch (error) {
      logger.error('Error getting analysis statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };
}

module.exports = new AnalysisController(); 