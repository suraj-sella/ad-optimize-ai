# Ad Optimize AI

## Project Overview

Ad Optimize AI is a backend-focused web application designed to help advertisers and marketers analyze their ad campaign data, generate actionable insights, and optimize strategies using advanced AI agents. Users can upload large CSV files containing ad performance data, which are then processed asynchronously. The system calculates key metrics, identifies top and bottom performers, and leverages LangChain-powered agents (integrated with LLMs) to generate human-readable insights and prioritized optimization recommendations. The frontend provides a minimal, user-friendly React interface for uploading files, tracking analysis progress, and viewing results.

## Architecture Diagram

![Architecture Diagram](frontend/public/architecture-diagram.svg)

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd ad-optimize-ai
   ```
2. **Install backend dependencies:**
   ```bash
   cd src
   npm install
   ```
3. **Install frontend dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```
4. **Set up environment variables:**
   - Copy `env.example` to `.env` and fill in required values (DB, LLM API keys, etc).
5. **Start the backend:**
   ```bash
   cd ../src
   npm start
   ```
6. **Start the frontend:**
   ```bash
   cd ../frontend
   npm run dev
   ```
7. **Access the app:**
   - Open [http://localhost:5173](http://localhost:5173) in your browser.

## API Documentation

### POST `/api/upload`

- **Description:** Upload a CSV file (up to 100MB). Returns a job ID for async processing.
- **Request:** `multipart/form-data` with `file` field.
- **Response:**
  ```json
  { "success": true, "data": { "jobId": "uuid", "filename": "...csv" } }
  ```

### GET `/api/analysis/:id`

- **Description:** Get analysis results and job status by job ID. Supports polling.
- **Response (processing):**
  ```json
  { "success": true, "data": { "status": "processing", "progress": 40, ... } }
  ```
- **Response (completed):**
  ```json
  { "success": true, "data": { "status": "completed", "analysis": { ... } } }
  ```
- **Response (failed):**
  ```json
  { "success": false, "error": "Analysis failed" }
  ```

### POST `/api/optimize/:id`

- **Description:** Generate optimization tasks based on analysis.
- **Request:** `{ "priority": "high|medium|low", "focus_areas": ["sales", ...] }`
- **Response:**
  ```json
  { "success": true, "data": { "tasks": [ ... ] } }
  ```

## Agent Design (LangChain Implementation)

- **Multi-Agent System:**
  - **DataAnalyzerAgent:** Parses CSV, calculates metrics, detects patterns/anomalies.
  - **InsightGeneratorAgent:** Uses LLM to generate human-readable insights and trends.
  - **TaskCreatorAgent:** Produces prioritized, actionable optimization tasks and recommendations.
- **Workflow:**
  1. Backend triggers agents after file upload.
  2. DataAnalyzerAgent processes and summarizes data.
  3. InsightGeneratorAgent crafts insights using prompt engineering and LLM API.
  4. TaskCreatorAgent generates optimization strategies and action items.
  5. Results are stored and served to the frontend.
- **Fallback:** If LLM fails, the system displays available metrics and trends, with a notice.

## Future Improvements

1. **Better UI/UX:** Enhance the frontend with richer visualizations, filtering, and more interactive dashboards.
2. **LLM Fallback:** Integrate multiple LLM providers (OpenAI, Claude, Gemini, open source) and implement automatic fallback if one fails.
3. **Business Ideas:** Add modules for budget forecasting, competitor analysis, and campaign simulation.
4. **User Management:** Support multi-user accounts, roles, and team collaboration features.
5. **Automated Scheduling:** Allow users to schedule recurring uploads and receive automated reports.
6. **API Rate Limiting & Security:** Add advanced rate limiting, audit logs, and improved security for production.
7. **Customizable Agent Prompts:** Let users fine-tune agent behavior and prompt templates for their business needs.

---

For any questions or contributions, please open an issue or contact the maintainers.
