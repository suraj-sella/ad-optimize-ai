# Backend Dockerfile
FROM node:18
WORKDIR /app
COPY ./src ./src
COPY ./package*.json ./
WORKDIR /app/src
RUN npm install
EXPOSE 3000
CMD ["npm", "start"] 