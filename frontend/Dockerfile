# Stage 1: Build
FROM node:18 AS builder

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm ci

# Copy app code
COPY . .

# Build the app using Vite
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose nginx's default port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
