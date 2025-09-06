# Complete Setup Guide for Anonverse

## 🚀 Quick Start (Recommended - Using Docker)

The easiest way is to use Docker Compose which sets up everything automatically:

```bash
# Clone your project
git clone https://github.com/pradipbhor/anonverse.git
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