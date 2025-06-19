import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Target, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { apiService } from '../services/api';

const ResultsScreen = ({ jobId }) => {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (jobId) {
      loadAnalysisData();
    }
  }, [jobId]);

  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getAnalysis(jobId);
      
      if (response.data.status === 'completed') {
        setAnalysisData(response.data);
        setLoading(false);
      } else if (response.data.status === 'processing' || response.data.status === 'pending') {
        setPolling(true);
        // Start polling for updates
        pollForUpdates();
      } else {
        setError('Analysis failed or not found');
        setLoading(false);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to load analysis results');
      setLoading(false);
    }
  };

  const pollForUpdates = async () => {
    let fetchingFinal = false;
    const pollInterval = setInterval(async () => {
      try {
        const response = await apiService.getAnalysis(jobId);
        setAnalysisData((prev) => ({ ...prev, ...response.data }));
        if (response.data.status === 'completed') {
          setLoading(false);
          setPolling(false);
          clearInterval(pollInterval);
        } else if (response.data.status === 'failed') {
          setError('Analysis failed');
          setLoading(false);
          setPolling(false);
          clearInterval(pollInterval);
        } else if (
          response.data.progress === 100 &&
          response.data.status !== 'completed' &&
          !fetchingFinal
        ) {
          // Immediately fetch one more time to get the completed result
          fetchingFinal = true;
          const finalResponse = await apiService.getAnalysis(jobId);
          setAnalysisData((prev) => ({ ...prev, ...finalResponse.data }));
          if (finalResponse.data.status === 'completed') {
            setLoading(false);
            setPolling(false);
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);

    setTimeout(() => {
      clearInterval(pollInterval);
      setPolling(false);
      setError('Analysis is taking longer than expected. Please check back later.');
      setLoading(false);
    }, 600000);
  };

  const generateOptimization = async () => {
    try {
      const response = await apiService.generateOptimization(jobId);
      // Reload analysis data to get updated optimization tasks
      await loadAnalysisData();
    } catch (error) {
      setError('Failed to generate optimization strategies');
    }
  };

  const formatMetric = (value, type = 'number') => {
    if (type === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    } else if (type === 'percentage') {
      return `${value.toFixed(2)}%`;
    } else {
      return new Intl.NumberFormat('en-US').format(value);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            {polling ? (analysisData?.message || 'Analyzing your data...') : 'Loading results...'}
          </p>
          {polling && (
            <div className="w-64 mx-auto">
              <Progress value={analysisData?.progress || 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Progress: {analysisData?.progress || 0}%
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold">Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={loadAnalysisData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">No Results Found</h2>
          <p className="text-muted-foreground">
            Please upload a file to see analysis results
          </p>
        </div>
      </div>
    );
  }

  const { analysis } = analysisData;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analysis Results</h1>
          <p className="text-muted-foreground">
            File: {analysisData.filename}
          </p>
        </div>
        <Button onClick={generateOptimization}>
          <Target className="h-4 w-4 mr-2" />
          Generate Optimization
        </Button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Keywords</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMetric(analysis.summary.metrics.totalKeywords)}
            </div>
            <p className="text-xs text-muted-foreground">
              Processed successfully
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average CTR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMetric(analysis.summary.metrics.averageCTR, 'percentage')}
            </div>
            <p className="text-xs text-muted-foreground">
              Click-through rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average ROAS</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMetric(analysis.summary.metrics.averageROAS)}
            </div>
            <p className="text-xs text-muted-foreground">
              Return on ad spend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average ACOS</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMetric(analysis.summary.metrics.averageACOS, 'percentage')}
            </div>
            <p className="text-xs text-muted-foreground">
              Advertising cost of sale
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trends Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Performance Trends</span>
          </CardTitle>
          <CardDescription>
            Key insights from your advertising data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {analysis.trends.highCostKeywords}
              </div>
              <p className="text-sm text-red-600 dark:text-red-400">High Cost Keywords</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {analysis.trends.lowCTRKeywords}
              </div>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">Low CTR Keywords</p>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {analysis.trends.highACOSKeywords}
              </div>
              <p className="text-sm text-orange-600 dark:text-orange-400">High ACOS Keywords</p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analysis.trends.zeroConversionKeywords}
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400">Zero Conversions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimization Tasks */}
      {analysis.optimizationTasks && analysis.optimizationTasks.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Optimization Recommendations</span>
              </CardTitle>
              <CardDescription>
                AI-generated strategies to improve your campaign performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.optimizationTasks.map((task, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>
                          {task.priority}
                        </Badge>
                        <span className="font-medium">{task.type}</span>
                      </div>
                      <Badge variant="outline">{task.estimatedImpact}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {task.description}
                    </p>
                    {task.actionItems && task.actionItems.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Action Items:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          {task.actionItems.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-center space-x-2">
                              <div className="w-1 h-1 bg-primary rounded-full"></div>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {/* AI Fallback Footnote */}
          {analysisData.aiGenerated === false && (
            <div className="text-xs text-yellow-600 mt-2">
              <strong>Note:</strong> Insights and recommendations shown here are template-based and not generated by AI due to a temporary fallback.
            </div>
          )}
        </>
      )}

      {/* Top Performers */}
      {analysis.performance.topPerformers && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performers by ROAS</CardTitle>
              <CardDescription>
                Keywords with the highest return on ad spend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.performance.topPerformers.byROAS?.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="font-medium">{item.keyword}</span>
                    <span className="text-sm text-muted-foreground">
                      ROAS: {formatMetric(item.calculated_roas)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Performers by CTR</CardTitle>
              <CardDescription>
                Keywords with the highest click-through rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.performance.topPerformers.byCTR?.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="font-medium">{item.keyword}</span>
                    <span className="text-sm text-muted-foreground">
                      CTR: {formatMetric(item.calculated_ctr, 'percentage')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ResultsScreen; 