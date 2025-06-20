import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.config?.url);
    return Promise.reject(error);
  }
);

// API methods
export const apiService = {
  // File upload
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get upload status
  getUploadStatus: async (jobId) => {
    const response = await api.get(`/upload/${jobId}`);
    return response.data;
  },

  // Get analysis results
  getAnalysis: async (jobId) => {
    const response = await api.get(`/analysis/${jobId}`);
    return response.data;
  },

  // Generate optimization strategies
  generateOptimization: async (jobId, options = {}) => {
    const response = await api.post(`/optimize/${jobId}`, options);
    return response.data;
  },

  // Get upload statistics
  getUploadStats: async () => {
    const response = await api.get('/upload/stats');
    return response.data;
  },

  // Get analysis statistics
  getAnalysisStats: async () => {
    const response = await api.get('/analysis/stats');
    return response.data;
  },

  // List uploads
  listUploads: async (page = 1, limit = 10, status = null) => {
    const params = { page, limit };
    if (status) params.status = status;
    
    const response = await api.get('/uploads', { params });
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  // Delete upload
  deleteUpload: async (jobId) => {
    const response = await api.delete(`/upload/${jobId}`);
    return response.data;
  },
};

export default apiService; 