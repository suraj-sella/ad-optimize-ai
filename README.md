# Ad Optimize AI

A sophisticated web application with advanced data processing and AI agent capabilities that allows users to upload ad data, perform complex analysis, and generate optimization strategies for advertising campaigns.

## Project Overview

Ad Optimize AI is a full-stack application designed to process large CSV files containing advertising data and provide intelligent insights for campaign optimization. The system features:

- **Large File Processing**: Handles CSV files up to 100MB with efficient streaming and validation
- **Asynchronous Job Processing**: Background processing with Redis-based job queues
- **Comprehensive Data Analysis**: Calculates key metrics (ROAS, ACOS, CTR, CPC, CPM) and identifies performance trends
- **Intelligent Recommendations**: Generates prioritized optimization strategies based on data analysis
- **Modern UI**: Clean, responsive interface built with React and Tailwind CSS
- **Scalable Architecture**: Built with PostgreSQL for data persistence and Redis for job management
- **RESTful API**: Clean, well-documented API endpoints for seamless integration

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (Express.js)  │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Job Queue     │
                       │   (Redis/Bull)  │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   CSV Processor │
                       │   (Background)  │
                       └─────────────────┘
```

## Tech Stack

### Frontend
- **Framework**: React 18
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Hooks
- **HTTP Client**: Axios
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Job Queue**: Redis + Bull
- **File Processing**: Multer + CSV-Parser
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting
- **AI Integration**: LangChain with HuggingFace (Mistral-7B-Instruct-v0.2)

### Development Tools
- **Package Manager**: npm
- **Development Server**: Nodemon (Backend), Vite (Frontend)
- **Linting**: ESLint

## Setup Instructions

### Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v12 or higher)
3. **Redis** (v6 or higher)
4. **HuggingFace Account** with API key

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ad-optimize-ai
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=ad_optimize_ai
   DB_USER=postgres
   DB_PASSWORD=your_password
   
   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   
   # File Upload Configuration
   MAX_FILE_SIZE=104857600
   UPLOAD_PATH=./uploads

   # AI Configuration
   HUGGINGFACE_API_KEY=your_huggingface_api_key
   LANGCHAIN_TRACING_V2=true
   LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
   LANGCHAIN_API_KEY=your_langchain_api_key
   ```

4. **Database Setup**
   ```bash
   # Create database
   createdb ad_optimize_ai
   
   # Run schema (using psql)
   psql -d ad_optimize_ai -f src/database/schema.sql
   ```

5. **Start Redis Server**
   ```bash
   # On macOS with Homebrew
   brew services start redis
   
   # On Ubuntu/Debian
   sudo systemctl start redis-server
   
   # On Windows
   redis-server
   ```

6. **Run the Backend**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

The backend server will start on `http://localhost:3000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Run the Frontend**
   ```bash
   # Development mode
   npm run dev
   
   # Build for production
   npm run build
   ```

The frontend will start on `http://localhost:5173`

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
Currently, the API is public. Authentication will be added in future versions.

### Endpoints

#### File Upload

**POST /api/upload**
Upload a CSV file for analysis.

- **Content-Type**: `multipart/form-data`
- **Field Name**: `file`
- **File Type**: CSV only
- **Max Size**: 100MB

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@your_ad_data.csv"
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "your_ad_data.csv",
    "fileSize": 1024000,
    "status": "pending",
    "estimatedProcessingTime": "2-5 minutes"
  }
}
```

#### Analysis Status

**GET /api/upload/:jobId**
Get the status of an upload/analysis job.

**Response (Processing):**
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "your_ad_data.csv",
    "status": "processing",
    "progress": 45,
    "message": "Analysis is still in progress"
  }
}
```

**Response (Completed):**
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "your_ad_data.csv",
    "status": "completed",
    "completedAt": "2024-01-15T10:30:00Z",
    "analysis": {
      "summary": {
        "totalRows": 1000,
        "processedRows": 985,
        "successRate": "98.5%",
        "metrics": {
          "totalKeywords": 985,
          "totalImpressions": 50000,
          "totalClicks": 2500,
          "totalCost": 5000,
          "totalSales": 15000,
          "averageCTR": 5.0,
          "averageCPC": 2.0,
          "averageROAS": 3.0,
          "averageACOS": 33.33
        }
      },
      "performance": {
        "topPerformers": {
          "byROAS": [...],
          "byCTR": [...],
          "bySales": [...]
        },
        "bottomPerformers": {
          "byROAS": [...],
          "byCTR": [...],
          "byACOS": [...]
        }
      },
      "trends": {
        "highCostKeywords": 25,
        "lowCTRKeywords": 150,
        "highACOSKeywords": 75,
        "zeroConversionKeywords": 200
      },
      "optimizationTasks": [...]
    }
  }
}
```

#### Analysis Results

**GET /api/analysis/:id**
Get detailed analysis results for a completed job.

**Response:** Same as the completed status response above.

#### Optimization Strategies

**POST /api/optimize/:id**
Generate enhanced optimization strategies.

**Request Body:**
```json
{
  "priority": "high",
  "focus_areas": ["ctr", "acos"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Optimization strategies generated successfully",
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "totalTasks": 3,
    "tasks": [
      {
        "type": "low_ctr",
        "priority": "high",
        "description": "150 keywords have CTR below 1%. Consider improving ad relevance and targeting.",
        "actionItems": [
          "Review and improve ad copy relevance",
          "Optimize keyword targeting",
          "A/B test different ad variations",
          "Improve landing page quality score"
        ],
        "estimatedEffort": "High (2-3 days)",
        "expectedROI": "15-25% improvement",
        "timeline": "1-2 weeks"
      }
    ]
  }
}
```

#### Utility Endpoints

**GET /api/health**
Health check endpoint.

**GET /api/info**
API information and documentation.

**GET /api/uploads**
List all uploads with pagination.

**GET /api/upload/stats**
Get upload statistics.

**GET /api/analysis/stats**
Get analysis statistics.

### Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created (file upload)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `413` - Payload Too Large (file too big)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

## Data Processing Pipeline

### CSV Processing
1. **File Validation**: Type, size, and format validation
2. **Data Cleaning**: Sanitization and type conversion
3. **Metric Calculation**: ROAS, ACOS, CTR, CPC, CPM
4. **Performance Analysis**: Top/bottom performers identification
5. **Trend Analysis**: Pattern recognition and anomaly detection

### Job Queue System
- **Redis-based**: Scalable job processing
- **Retry Logic**: Automatic retry with exponential backoff
- **Progress Tracking**: Real-time progress updates
- **Error Handling**: Comprehensive error logging and recovery

### Database Schema
- **analysis_jobs**: Job metadata and status tracking
- **processed_data**: Raw processed CSV data
- **analysis_results**: Aggregated analysis results
- **optimization_tasks**: Generated optimization strategies
- **historical_data**: Historical performance data

## Development

### Backend Development
```bash
# Linting
npm run lint

# Development mode
npm run dev

# Production build
npm start
```

### Frontend Development
```bash
cd frontend

# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Environment Variables
Ensure all environment variables are properly configured for production:

```env
NODE_ENV=production
PORT=3000
DB_HOST=your-production-db-host
DB_PASSWORD=your-secure-password
REDIS_HOST=your-production-redis-host
```

### Database Migration
Run the schema file on your production database:
```bash
psql -h your-db-host -U your-user -d your-db -f src/database/schema.sql
```

### Process Management
Use PM2 or similar process manager:
```bash
npm install -g pm2
pm2 start src/server.js --name "ad-optimize-ai-backend"
```

### Frontend Deployment
Build the frontend for production:
```bash
cd frontend
npm run build
```

## Docker Containerization (Optional)

You can run the backend in a Docker container for production or testing. For local development, continue using your usual method (`npm run dev`).

### Build the Docker image
```bash
docker build -t ad-optimize-ai-backend .
```

### Run the container
```bash
docker run -d --name ad-optimize-ai-backend -p 3000:3000 --env-file .env ad-optimize-ai-backend
```

- Make sure your `.env` file is present and configured.
- The backend will be available at `http://localhost:3000` inside the container.

## Future Improvements

1. **Enhanced AI Analysis**: Implement more sophisticated HuggingFace models for deeper insights
2. **Real-time Notifications**: WebSocket support for live progress updates
3. **Advanced Analytics**: Machine learning models for predictive insights
4. **Multi-tenant Support**: User authentication and data isolation
5. **API Rate Limiting**: Per-user rate limiting and quotas
6. **Data Export**: Export analysis results in various formats
7. **Scheduled Analysis**: Automated periodic analysis of campaign data
8. **Integration APIs**: Connect with advertising platforms (Google Ads, Facebook Ads)
9. **Advanced Visualization**: Generate charts and graphs for insights
10. **Mobile App**: React Native mobile application
11. **File Storage**: Use AWS S3 Storage for large csv files accumulated over time.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure code follows linting rules
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact:
- Email: hello@aakaarai.com
- Email: prince@aakaarai.com

## Changelog

### v1.0.0
- Initial release
- Backend API with CSV file upload and processing
- Basic analysis and optimization generation
- RESTful API implementation
- Job queue system
- Database integration
- React frontend with Tailwind CSS and shadcn/ui
- Modern, responsive user interface

## Acknowledgments

- [LangChain](https://js.langchain.com/docs/) for AI integration
- [HuggingFace](https://huggingface.co/) for providing the Mistral-7B-Instruct model
