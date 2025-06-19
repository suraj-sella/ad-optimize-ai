# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create directories for uploads and logs
RUN mkdir -p /app/uploads /app/logs

# Expose the backend port
EXPOSE 3000

# Set environment variables (can be overridden at runtime)
ENV NODE_ENV=production
# NOTE: Pass DB credentials, API keys, etc. at runtime using -e or --env-file

# Define volumes for persistent data
VOLUME ["/app/uploads", "/app/logs"]

# Add a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Add a healthcheck (expects /health endpoint to exist)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the backend server
CMD ["node", "src/server.js"] 