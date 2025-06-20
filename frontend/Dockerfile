# Frontend Dockerfile
FROM node:18 as build
WORKDIR /app
COPY . .

# Allow Railway to inject VITE_API_BASE_URL at build time
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm install && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 