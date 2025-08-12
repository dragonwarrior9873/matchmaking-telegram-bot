#!/bin/bash

echo "🚀 Setting up Matchmaking Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if MongoDB is available
if ! command -v mongod &> /dev/null && ! command -v mongo &> /dev/null; then
    echo "❌ MongoDB is not installed. Please install MongoDB first."
    exit 1
fi

# Redis is no longer required

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing!"
    echo "   Required: BOT_TOKEN, MONGODB_URI"
    echo "   Run: nano .env"
    exit 0
fi

# Check if .env has required variables
if ! grep -q "BOT_TOKEN=" .env || ! grep -q "MONGODB_URI=" .env; then
    echo "❌ Please configure BOT_TOKEN and MONGODB_URI in .env file"
    exit 1
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Initialize MongoDB database
echo "🗄️ Initializing MongoDB database..."
npm run migrate

echo "🎉 Setup complete!"
echo ""
echo "🚀 To start the bot:"
echo "   npm run dev    # Development mode"
echo "   npm start      # Production mode"
echo ""
echo "📚 Check README.md for detailed configuration guide"
