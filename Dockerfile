# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose the backend port
EXPOSE 3000

# Set environment variables (can be overridden at runtime)
ENV NODE_ENV=production

# Start the backend server
CMD ["node", "src/server.js"] 