import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { apiService } from "../services/api";

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

      if (response.success === false) {
        setError(response.error || "Analysis failed");
        setLoading(false);
        setPolling(false);
        return;
      }
      if (response.data.status === "completed") {
        setAnalysisData(response.data);
        setLoading(false);
      } else if (
        response.data.status === "processing" ||
        response.data.status === "pending"
      ) {
        setPolling(true);
        // Start polling for updates
        pollForUpdates();
      } else if (response.data.status === "failed") {
        setError("Analysis failed");
        setLoading(false);
        setPolling(false);
      } else {
        setError("Analysis failed or not found");
        setLoading(false);
        setPolling(false);
      }
    } catch (error) {
      setError(
        error.response?.data?.error || "Failed to load analysis results"
      );
      setLoading(false);
    }
  };

  const pollForUpdates = async () => {
    let fetchingFinal = false;
    const pollInterval = setInterval(async () => {
      try {
        const response = await apiService.getAnalysis(jobId);
        setAnalysisData(response.data);
        if (response.data.status === "completed") {
          setLoading(false);
          setPolling(false);
          clearInterval(pollInterval);
        } else if (
          response.data.status === "failed" ||
          response.data.success === false
        ) {
          setError("Analysis failed");
          setLoading(false);
          setPolling(false);
          clearInterval(pollInterval);
        } else if (
          response.data.progress === 100 &&
          response.data.status !== "completed" &&
          !fetchingFinal
        ) {
          // Immediately fetch one more time to get the completed result
          fetchingFinal = true;
          const finalResponse = await apiService.getAnalysis(jobId);
          setAnalysisData(finalResponse.data);
          if (finalResponse.data.status === "completed") {
            setLoading(false);
            setPolling(false);
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 5000);

    const timeoutId = setTimeout(() => {
      clearInterval(pollInterval);
      setPolling(false);
      setError(
        "Analysis is taking longer than expected. Please check back later."
      );
      setLoading(false);
    }, 600000);

    // When analysis completes:
    clearTimeout(timeoutId);
  };

  const formatMetric = (value, type = "number") => {
    if (type === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);
    } else if (type === "percentage") {
      return `${value.toFixed(2)}%`;
    } else {
      return new Intl.NumberFormat("en-US").format(value);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            {polling
              ? analysisData?.message || "Analyzing your data..."
              : "Loading results..."}
          </p>
          {polling && (
            <div className="w-64 mx-auto">
              <Progress value={analysisData?.progress || 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Progress: {analysisData?.progress || 0}%
              </p>
            </div>
          )}
          {/* Footnote for user guidance during long analysis */}
          {polling && (
            <div className="text-xs text-muted-foreground mt-4">
              You can return to the dashboard while we analyze your data and generate insights.<br />
              Once the analysis is complete, you can access the results from the dashboard.
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

  // Defensive: check if all key analysis fields are missing or empty
  const isAnalysisEmpty =
    (!analysis.performance?.topPerformers ||
      Object.values(analysis.performance.topPerformers || {}).every(
        (arr) => !arr || arr.length === 0
      )) &&
    (!analysis.performance?.bottomPerformers ||
      Object.values(analysis.performance.bottomPerformers || {}).every(
        (arr) => !arr || arr.length === 0
      )) &&
    (!analysis.trends ||
      Object.values(analysis.trends || {}).every((val) => !val)) &&
    (!analysis.insights ||
      !Array.isArray(analysis.insights.insights) ||
      analysis.insights.insights.length === 0) &&
    (!analysis.tasks ||
      !Array.isArray(analysis.tasks.tasks) ||
      analysis.tasks.tasks.length === 0) &&
    (!analysis.optimizationTasks || analysis.optimizationTasks.length === 0);

  if (isAnalysisEmpty) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
          <h2 className="text-xl font-semibold">No Analysis Results</h2>
          <p className="text-muted-foreground">
            No meaningful analysis results are available for this upload.
            <br />
            Please try another file or return to the dashboard using the
            navigation bar above.
          </p>
        </div>
      </div>
    );
  }

  // Fallback detection for LLM/AI failure
  const aiInsightsFailed =
    analysis.insights &&
    ((Array.isArray(analysis.insights.insights) &&
      analysis.insights.insights.length === 1 &&
      analysis.insights.insights[0].message?.includes('Failed to generate insights via LLM')) ||
      analysis.insights.aiGenerated === false);
  const showAISections = !aiInsightsFailed && analysis.insights?.aiGenerated !== false;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Analysis Results
          </h1>
          <p className="text-muted-foreground">File: {analysisData.filename}</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Keywords
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMetric(analysis.summary.metrics.rowCount)}
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
              {formatMetric(analysis.summary.metrics.averageCTR, "percentage")}
            </div>
            <p className="text-xs text-muted-foreground">Click-through rate</p>
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
            <p className="text-xs text-muted-foreground">Return on ad spend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average ACOS</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMetric(analysis.summary.metrics.averageACOS, "percentage")}
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
              <p className="text-sm text-red-600 dark:text-red-400">
                High Cost Keywords
              </p>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {analysis.trends.lowCTRKeywords}
              </div>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Low CTR Keywords
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {analysis.trends.highACOSKeywords}
              </div>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                High ACOS Keywords
              </p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analysis.trends.zeroConversionKeywords}
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Zero Conversions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Section */}
      {showAISections && analysis.insights &&
        Array.isArray(analysis.insights.insights) &&
        analysis.insights.insights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>AI Insights</span>
              </CardTitle>
              <CardDescription>
                Human-readable insights generated by the AI agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6 space-y-2">
                {analysis.insights.insights.map((insight, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {insight.message || insight}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

      {/* AI Tasks Section */}
      {showAISections && analysis.tasks &&
        Array.isArray(analysis.tasks.tasks) &&
        analysis.tasks.tasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>AI-Generated Actionable Tasks</span>
              </CardTitle>
              <CardDescription>
                Action items and recommendations generated by the AI agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.tasks.tasks.map((task, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            task.priority === "high"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {task.priority}
                        </Badge>
                        <span className="font-medium">{task.type}</span>
                      </div>
                      <Badge variant="outline">{task.impact}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {task.description}
                    </p>
                    {task.action_items && task.action_items.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Action Items:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          {task.action_items.map((item, itemIndex) => (
                            <li
                              key={itemIndex}
                              className="flex items-center space-x-2"
                            >
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
        )}

      {/* Fallback Notice for LLM Failure */}
      {aiInsightsFailed && (
        <div className="text-xs text-yellow-600 mt-2">
          <strong>Note:</strong> AI-generated insights are unavailable for this report. Showing available data only.
        </div>
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
                {analysis.performance.topPerformers.byROAS
                  ?.slice(0, 5)
                  .map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
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
                {analysis.performance.topPerformers.byCTR
                  ?.slice(0, 5)
                  .map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
                      <span className="font-medium">{item.keyword}</span>
                      <span className="text-sm text-muted-foreground">
                        CTR: {formatMetric(item.calculated_ctr, "percentage")}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Performers */}
      {analysis.performance.bottomPerformers && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Bottom Performers by CTR</CardTitle>
              <CardDescription>
                Keywords with the lowest click-through rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.performance.bottomPerformers.byCTR
                  ?.slice(0, 5)
                  .map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
                      <span className="font-medium">{item.keyword}</span>
                      <span className="text-sm text-muted-foreground">
                        CTR: {formatMetric(item.calculated_ctr, "percentage")}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bottom Performers by ACOS</CardTitle>
              <CardDescription>
                Keywords with the highest advertising cost of sale
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.performance.bottomPerformers.byACOS
                  ?.slice(0, 5)
                  .map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
                      <span className="font-medium">{item.keyword}</span>
                      <span className="text-sm text-muted-foreground">
                        ACOS: {formatMetric(item.calculated_acos, "percentage")}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bottom Performers by ROAS</CardTitle>
              <CardDescription>
                Keywords with the lowest return on ad spend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.performance.bottomPerformers.byROAS
                  ?.slice(0, 5)
                  .map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
                      <span className="font-medium">{item.keyword}</span>
                      <span className="text-sm text-muted-foreground">
                        ROAS: {formatMetric(item.calculated_roas)}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Zero Conversion Keywords */}
      {analysis.trends && analysis.trends.zeroConversionKeywords && Array.isArray(analysis.insights?.insights?.["2. Notable trends"]?.["Zero Conversion Keywords"]) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Zero Conversion Keywords</CardTitle>
            <CardDescription>
              Keywords that have not resulted in any conversions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 space-y-1">
              {analysis.insights.insights["2. Notable trends"]["Zero Conversion Keywords"].slice(0, 20).map((keyword, idx) => (
                <li key={idx} className="text-muted-foreground">{keyword}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResultsScreen;
