import React, { useState, useEffect } from "react";
import {
  Upload,
  BarChart3,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { apiService } from "../services/api";

const DashboardScreen = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [recentUploads, setRecentUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingJobId, setDeletingJobId] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [uploadStats, uploadsResponse] = await Promise.all([
        apiService.getUploadStats(),
        apiService.listUploads(1, 5),
      ]);

      setStats(uploadStats.data);
      setRecentUploads(uploadsResponse.data.uploads || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      completed: "success",
      processing: "secondary",
      failed: "destructive",
      pending: "outline",
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const handleDeleteUpload = async (jobId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this upload and all associated data? This action cannot be undone."
      )
    ) {
      return;
    }
    setDeletingJobId(jobId);
    try {
      await apiService.deleteUpload(jobId);
      setRecentUploads((prev) => {
        const updated = prev.filter((u) => u.job_id !== jobId);
        // Notify parent if no uploads left
        if (updated.length === 0) {
          onNavigate && onNavigate("dashboard", null, 0);
        }
        return updated;
      });
      // Optionally reload stats
      loadDashboardData();
    } catch (error) {
      alert("Failed to delete upload. Please try again.");
    } finally {
      setDeletingJobId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">
          Welcome to Ad Optimize AI
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Upload your advertising data and get intelligent insights to optimize
          your campaigns
        </p>
        <Button
          size="lg"
          onClick={() => onNavigate("upload", null, recentUploads.length)}
          className="mt-4"
        >
          <Upload className="h-5 w-5 mr-2" />
          Upload CSV File
        </Button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Uploads
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalUploads || 0}
              </div>
              <p className="text-xs text-muted-foreground">All time uploads</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.completedUploads || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Successful analyses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.processingUploads || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently analyzing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.failedUploads || 0}
              </div>
              <p className="text-xs text-muted-foreground">Failed uploads</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Uploads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Recent Uploads</span>
          </CardTitle>
          <CardDescription>
            Your latest file uploads and their analysis status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentUploads.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No uploads yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => onNavigate("upload", null, 0)}
              >
                Upload your first file
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentUploads.map((upload) => (
                <div
                  key={upload.job_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (upload.status === "failed") return;
                    onNavigate("results", upload.job_id, recentUploads.length);
                  }}
                >
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(upload.status)}
                    <div>
                      <p className="font-medium">{upload.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {(upload.file_size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {getStatusBadge(upload.status)}
                    <p className="text-sm text-muted-foreground">
                      {new Date(upload.created_at).toLocaleDateString()}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deletingJobId === upload.job_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUpload(upload.job_id);
                      }}
                      title="Delete upload"
                    >
                      {deletingJobId === upload.job_id ? (
                        <span className="animate-spin">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </span>
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Upload New File</span>
            </CardTitle>
            <CardDescription>
              Upload a CSV file to start your analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => onNavigate("upload", null, recentUploads.length)}
            >
              Start Upload
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>View Results</span>
            </CardTitle>
            <CardDescription>
              Check your analysis results and optimizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onNavigate("results", null, recentUploads.length)}
              disabled={recentUploads.length === 0}
            >
              View Results
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardScreen;
