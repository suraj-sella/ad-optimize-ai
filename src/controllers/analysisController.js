const logger = require('../utils/logger');
const jobQueue = require('../services/jobQueue');
const db = require('../config/database');

class AnalysisController {
  /**
   * Get analysis results for a specific job
   */
  async getAnalysis(req, res) {
    try {
      const { id } = req.params;

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
  }

  /**
   * Format analysis results for API response
   */
  formatAnalysisResults(results) {
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
  }

  /**
   * Generate optimization strategies
   */
  async generateOptimization(req, res) {
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

      // Get current optimization tasks
      const currentTasks = await this.getOptimizationTasks(id);

      // Generate enhanced optimization strategies
      const enhancedTasks = await this.enhanceOptimizationTasks(currentTasks, priority, focus_areas);

      // Update optimization tasks in database
      await this.updateOptimizationTasks(id, enhancedTasks);

      logger.info(`Generated optimization strategies for job ${id}`);

      res.json({
        success: true,
        message: 'Optimization strategies generated successfully',
        data: {
          jobId: id,
          totalTasks: enhancedTasks.length,
          tasks: enhancedTasks
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
  }

  /**
   * Get optimization tasks for a job
   */
  async getOptimizationTasks(jobId) {
    try {
      const query = `
        SELECT 
          task_type,
          priority,
          description,
          action_items,
          estimated_impact,
          status
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

      const result = await db.query(query, [jobId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting optimization tasks:', error);
      throw error;
    }
  }

  /**
   * Enhance optimization tasks with more detailed strategies
   */
  async enhanceOptimizationTasks(tasks, priority, focusAreas) {
    const enhancedTasks = [];

    for (const task of tasks) {
      // Filter by priority if specified
      if (priority && task.priority !== priority) {
        continue;
      }

      // Filter by focus areas if specified
      if (focusAreas && focusAreas.length > 0) {
        const taskType = task.task_type.toLowerCase();
        const hasFocusArea = focusAreas.some(area => 
          taskType.includes(area.toLowerCase())
        );
        if (!hasFocusArea) {
          continue;
        }
      }

      // Enhance task with detailed action items
      const enhancedTask = {
        ...task,
        actionItems: this.generateActionItems(task),
        estimatedEffort: this.estimateEffort(task.priority),
        expectedROI: this.estimateROI(task.estimated_impact),
        timeline: this.estimateTimeline(task.priority)
      };

      enhancedTasks.push(enhancedTask);
    }

    return enhancedTasks;
  }

  /**
   * Generate detailed action items for a task
   */
  generateActionItems(task) {
    const actionItems = [];

    switch (task.task_type) {
      case 'low_ctr':
        actionItems.push(
          'Review and improve ad copy relevance',
          'Optimize keyword targeting',
          'A/B test different ad variations',
          'Improve landing page quality score'
        );
        break;

      case 'high_acos':
        actionItems.push(
          'Reduce bid amounts for underperforming keywords',
          'Pause keywords with ACOS > 50%',
          'Improve product listing quality',
          'Optimize negative keyword strategy'
        );
        break;

      case 'zero_conversions':
        actionItems.push(
          'Review landing page conversion funnel',
          'Check product availability and pricing',
          'Improve ad-to-landing page relevance',
          'Consider remarketing strategies'
        );
        break;

      default:
        actionItems.push(
          'Analyze keyword performance data',
          'Review competitive landscape',
          'Optimize campaign structure'
        );
    }

    return actionItems;
  }

  /**
   * Estimate effort level for a task
   */
  estimateEffort(priority) {
    const effortMap = {
      high: 'High (2-3 days)',
      medium: 'Medium (1-2 days)',
      low: 'Low (4-8 hours)'
    };
    return effortMap[priority] || 'Medium (1-2 days)';
  }

  /**
   * Estimate ROI for a task
   */
  estimateROI(impact) {
    const roiMap = {
      high: '15-25% improvement',
      medium: '8-15% improvement',
      low: '3-8% improvement'
    };
    return roiMap[impact] || '5-10% improvement';
  }

  /**
   * Estimate timeline for a task
   */
  estimateTimeline(priority) {
    const timelineMap = {
      high: '1-2 weeks',
      medium: '2-4 weeks',
      low: '4-6 weeks'
    };
    return timelineMap[priority] || '2-4 weeks';
  }

  /**
   * Update optimization tasks in database
   */
  async updateOptimizationTasks(jobId, enhancedTasks) {
    try {
      // Get the analysis job ID
      const jobQuery = 'SELECT id FROM analysis_jobs WHERE job_id = $1';
      const jobResult = await db.query(jobQuery, [jobId]);
      
      if (jobResult.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const analysisJobId = jobResult.rows[0].id;

      // Update each task
      for (const task of enhancedTasks) {
        const query = `
          UPDATE optimization_tasks 
          SET 
            action_items = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE job_id = $2 AND task_type = $3
        `;

        await db.query(query, [
          JSON.stringify(task.actionItems),
          analysisJobId,
          task.task_type
        ]);
      }

      logger.info(`Updated ${enhancedTasks.length} optimization tasks for job ${jobId}`);
    } catch (error) {
      logger.error('Error updating optimization tasks:', error);
      throw error;
    }
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_analyses,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_analyses,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_analyses,
          AVG(CASE WHEN status = 'completed' THEN processed_rows END) as avg_processed_rows,
          AVG(CASE WHEN status = 'completed' THEN total_rows END) as avg_total_rows
        FROM analysis_results ar
        JOIN analysis_jobs aj ON ar.job_id = aj.id
      `;

      const result = await db.query(statsQuery);
      const stats = result.rows[0];

      // Get optimization task statistics
      const taskStatsQuery = `
        SELECT 
          priority,
          COUNT(*) as count
        FROM optimization_tasks
        GROUP BY priority
      `;

      const taskResult = await db.query(taskStatsQuery);
      const taskStats = {
        high: 0,
        medium: 0,
        low: 0
      };

      taskResult.rows.forEach(row => {
        taskStats[row.priority] = parseInt(row.count);
      });

      res.json({
        success: true,
        data: {
          analyses: {
            total: parseInt(stats.total_analyses),
            completed: parseInt(stats.completed_analyses),
            failed: parseInt(stats.failed_analyses),
            successRate: stats.total_analyses > 0 ? 
              ((stats.completed_analyses / stats.total_analyses) * 100).toFixed(2) + '%' : '0%'
          },
          dataProcessing: {
            avgProcessedRows: Math.round(stats.avg_processed_rows || 0),
            avgTotalRows: Math.round(stats.avg_total_rows || 0),
            avgProcessingRate: stats.avg_total_rows > 0 ? 
              ((stats.avg_processed_rows / stats.avg_total_rows) * 100).toFixed(2) + '%' : '0%'
          },
          optimizationTasks: taskStats
        }
      });

    } catch (error) {
      logger.error('Error getting analysis stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analysis statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new AnalysisController(); 