# Complete Setup Guide for Anonverse

## 🚀 Quick Start (Recommended - Using Docker)

The easiest way is to use Docker Compose which sets up everything automatically:

```bash
# Clone your project
git clone <your-repo>
cd anonverse

# Start all services with Docker
docker-compose up --build

# That's it! Everything is running:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:5000
# - Redis: localhost:6379
# - MongoDB: localhost:27017
```

## 🛠️ Manual Setup (Local Installation)

If you prefer to install everything locally:

### 1. Install Node.js
```bash
# Download from https://nodejs.org/ (v18+ recommended)
# Or use package managers:

# macOS (Homebrew)
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows (Chocolatey)
choco install nodejs

# Verify installation
node --version
npm --version
```

### 2. Install Redis

#### macOS (Homebrew)
```bash
# Install Redis
brew install redis

# Start Redis server
brew services start redis

# Or run manually
redis-server

# Test Redis
redis-cli ping
# Should return: PONG
```

#### Ubuntu/Debian
```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis
redis-cli ping
# Should return: PONG
```

#### Windows
```bash
# Option 1: Using WSL2 (Recommended)
# Install WSL2 first, then follow Ubuntu instructions

# Option 2: Using Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine

# Option 3: Windows installer (not recommended for production)
# Download from: https://github.com/microsoftarchive/redis/releases
```

#### CentOS/RHEL/Fedora
```bash
# Install Redis
sudo dnf install redis  # Fedora
sudo yum install redis  # CentOS/RHEL

# Start Redis
sudo systemctl start redis
sudo systemctl enable redis

# Test Redis
redis-cli ping
```

### 3. Install MongoDB

#### macOS (Homebrew)
```bash
# Add MongoDB tap
brew tap mongodb/brew

# Install MongoDB Community Edition
brew install mongodb-community

# Start MongoDB
brew services start mongodb/brew/mongodb-community

# Or run manually
mongod --config /usr/local/etc/mongod.conf
```

#### Ubuntu/Debian
```bash
# Import public key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update and install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Test MongoDB
mongosh
```

#### Windows
```bash
# Option 1: MongoDB Community Server
# Download from: https://www.mongodb.com/try/download/community
# Follow installer instructions

# Option 2: Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:6

# Option 3: MongoDB Atlas (Cloud)
# Sign up at: https://www.mongodb.com/atlas
```

### 4. Verify All Services

```bash
# Test Redis
redis-cli ping
# Expected: PONG

# Test MongoDB
mongosh --eval "db.adminCommand('ismaster')"
# Expected: Connection successful

# Check if ports are open
netstat -an | grep 6379  # Redis
netstat -an | grep 27017 # MongoDB
```

## 📦 Project Dependencies

### Backend Dependencies
```bash
cd backend
npm install

# Core dependencies that will be installed:
# - express: Web framework
# - socket.io: Real-time communication
# - mongoose: MongoDB ODM
# - redis: Redis client
# - cors: CORS middleware
# - helmet: Security middleware
# - winston: Logging
# - joi: Validation
# - bcryptjs: Password hashing
# - jsonwebtoken: JWT authentication
# - axios: HTTP client
# - dotenv: Environment variables
# - express-rate-limit: Rate limiting
# - compression: Response compression
# - multer: File uploads (future feature)
# - openai: Content moderation
```

### Frontend Dependencies
```bash
cd frontend
npm install

# Core dependencies that will be installed:
# - react: UI framework
# - react-dom: React DOM renderer
# - react-router-dom: Routing
# - socket.io-client: Socket.io client
# - lucide-react: Icons
# - axios: HTTP client
# - tailwindcss: CSS framework
# - framer-motion: Animations (optional)
```

## ⚙️ Environment Configuration

### Backend Environment (.env)
```bash
cd backend
cp .env.example .env

# Edit .env file:
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000

# Database
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/anonverse

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this

# OpenAI (optional - for content moderation)
OPENAI_API_KEY=your-openai-api-key

# WebRTC (optional - for production TURN servers)
TURN_SERVER_URL=
TURN_SERVER_USERNAME=
TURN_SERVER_CREDENTIAL=
```

### Frontend Environment (.env)
```bash
cd frontend
cp .env.example .env

# Edit .env file:
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=ws://localhost:5000
REACT_APP_ENVIRONMENT=development
```

## 🚀 Running the Application

### Option 1: Manual Start
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start MongoDB
mongod

# Terminal 3: Start Backend
cd backend
npm run dev

# Terminal 4: Start Frontend
cd frontend
npm start

# Access the app at: http://localhost:3000
```

### Option 2: Using Docker Compose (Recommended)
```bash
# Start everything
docker-compose up --build

# Run in background
docker-compose up -d --build

# Stop everything
docker-compose down

# View logs
docker-compose logs -f
```

### Option 3: Development Scripts
Create these package.json scripts in your root directory:

```json
{
  "name": "anonverse",
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm start",
    "install:all": "npm install && cd backend && npm install && cd ../frontend && npm install",
    "build": "cd frontend && npm run build",
    "start": "cd backend && npm start"
  },
  "devDependencies": {
    "concurrently": "^7.6.0"
  }
}
```

Then run:
```bash
# Install all dependencies
npm run install:all

# Start both frontend and backend
npm run dev
```

## 🔧 Additional Tools & Dependencies

### Optional but Recommended

#### 1. MongoDB Compass (GUI for MongoDB)
```bash
# Download from: https://www.mongodb.com/products/compass
# Provides visual interface for MongoDB
```

#### 2. Redis Insight (GUI for Redis)
```bash
# Download from: https://redis.com/redis-enterprise/redis-insight/
# Or use Redis Commander:
npm install -g redis-commander
redis-commander
```

#### 3. Process Manager (Production)
```bash
# PM2 for process management
npm install -g pm2

# Start backend with PM2
cd backend
pm2 start ecosystem.config.js
```

#### 4. Development Tools
```bash
# Global tools for development
npm install -g nodemon    # Auto-restart on changes
npm install -g concurrently  # Run multiple commands
npm install -g cross-env     # Cross-platform env vars
```

## 🐳 Docker Setup (Complete)

### docker-compose.yml
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:5000
      - REACT_APP_SOCKET_URL=ws://localhost:5000
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - MONGODB_URI=mongodb://mongo:27017/anonverse
    depends_on:
      - redis
      - mongo

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=anonverse
    volumes:
      - mongo_data:/data/db

volumes:
  redis_data:
  mongo_data:
```

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping

# Start Redis if not running
redis-server

# Check Redis configuration
redis-cli config get "*"

# Clear Redis data (if needed)
redis-cli flushall
```

#### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Start MongoDB if not running
mongod

# Check MongoDB logs
tail -f /var/log/mongodb/mongod.log  # Linux
tail -f /usr/local/var/log/mongodb/mongo.log  # macOS
```

#### Port Conflicts
```bash
# Check what's using ports
lsof -i :3000  # Frontend
lsof -i :5000  # Backend
lsof -i :6379  # Redis
lsof -i :27017 # MongoDB

# Kill processes if needed
kill -9 <PID>
```

#### Permission Issues (Linux/macOS)
```bash
# Fix npm permission issues
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Or use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
```

## ✅ Verification Checklist

Before running your app, verify:

- [ ] Node.js v18+ installed
- [ ] Redis server running on port 6379
- [ ] MongoDB server running on port 27017
- [ ] Backend dependencies installed (`npm install` in backend/)
- [ ] Frontend dependencies installed (`npm install` in frontend/)
- [ ] Environment files configured (.env files)
- [ ] Ports 3000, 5000, 6379, 27017 are available
- [ ] No firewall blocking the ports

## 🚀 Production Deployment

For production, consider:

1. **Cloud Services:**
   - MongoDB Atlas (managed MongoDB)
   - Redis Cloud (managed Redis)
   - Heroku, Railway, or DigitalOcean for hosting

2. **Security:**
   - Use strong passwords and secrets
   - Enable authentication for Redis and MongoDB
   - Use SSL/TLS certificates
   - Configure firewall rules

3. **Monitoring:**
   - Set up logging and monitoring
   - Configure alerts for downtime
   - Monitor resource usage

That's everything you need to run Anonverse locally! 🎉