# 🤝 Crypto Project Matchmaking Bot

A Telegram bot that helps crypto projects find each other for AMAs and collaborations through a "swipe-like" matching system.

## ✨ Features

- **Token Onboarding**: Simple registration with token details and admin setup
- **Smart Browsing**: Tinder-like browsing with Like/Pass buttons for token discovery
- **Matchmaking**: Automatic matching when two tokens like each other
- **Announcements**: Automatic match announcements to configured channels
- **Private Coordination**: Private group creation for matched token admins
- **Direct Processing**: Immediate handling of match notifications

## 🏗️ Architecture

- **Runtime**: Node.js with TypeScript
- **Bot Framework**: grammY (Telegram Bot API)
- **Database**: MongoDB with Mongoose ODM
- **Notifications**: Direct processing without queue system
- **Interface**: Matchmaker logo and token-focused UI

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB database
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### 1. Clone and Install

```bash
git clone <your-repo>
cd matchmakingbot
npm install
```

### 2. Environment Setup

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Required
BOT_TOKEN=your_bot_token_from_botfather
MONGODB_URI=mongodb://localhost:27017/matchmaking_bot

# Bot Configuration
ANNOUNCEMENT_CHANNEL_ID=-1001234567890  # Your announcement channel
ADMIN_USER_ID=123456789  # Your Telegram user ID
MATCH_GROUP_TEMPLATE_ID=-1001234567890  # Template group for matches
```

### 3. Database Setup

```bash
# Make sure MongoDB is running
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS

# Initialize database and create indexes
npm run migrate

# Optional: Seed with sample data for testing
npm run seed
```

### 4. Start the Bot

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 📋 Bot Commands

### User Commands
- `/start` - Start the bot and show main menu
- `/help` - Show help information  
- `/menu` - Show main menu
- `/status` - Check registration status
- `/matches` - View token matches

### Admin Commands (requires ADMIN_USER_ID)
- `/admin` - Show admin panel
- `/admin_stats` - View bot statistics

## 🔄 User Flow

### 1. Token Registration
1. User starts bot with `/start`
2. Chooses "🚀 Register Token" 
3. Simple form:
   - Token name
   - Logo/GIF upload
   - Contract address
   - Blockchain networks
   - Telegram links
   - Admin handles
4. Token becomes active immediately

### 2. Token Discovery  
1. User chooses "👀 Browse Tokens"
2. Bot shows token cards one by one
3. User clicks 👍 Like or 👎 Pass
4. If mutual like → Match created!

### 3. Match Flow
1. Match detected automatically
2. Announcement posted to configured channel
3. Private group created
4. All admins from both tokens invited
5. Coordination begins in private room

## 🗄️ Database Schema

### Core Collections
- `projects` - Token information and metadata
- `admins` - Token admin associations  
- `projectlikes` - Like relationships
- `matches` - Mutual like records
- `matchgroups` - Private group information

### Key Features
- MongoDB ObjectId primary keys
- Automatic timestamps with Mongoose
- Unique constraints on critical relationships
- Optimized indexes for performance
- Document-based flexible schema

## 🔧 Configuration

### Blockchain Networks
Supported chains (no verification needed):
- Ethereum
- Polygon
- BSC (Binance Smart Chain)
- Arbitrum
- Optimism
- Base
- Solana
- Avalanche

### Direct Processing
- **Match Announcements**: Immediately posted to announcement channel
- **Private Groups**: Instant coordination room creation
- **Simple Registration**: No verification needed, instant activation

## 🚀 Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
CMD ["npm", "start"]
```

### Environment Variables for Production

```env
NODE_ENV=production
MONGODB_URI=mongodb://mongo:27017/matchmaking_bot
BOT_TOKEN=your_production_token
```

## 🔒 Security Considerations

- Store sensitive tokens in environment variables
- Use connection pooling for database
- Implement rate limiting for API calls
- Validate all user inputs
- Use HTTPS for webhook deployment
- Regular security updates

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql
# Verify connection string in .env
```

**Redis Connection Failed**  
```bash
# Check Redis is running
sudo systemctl status redis
# Verify REDIS_URL in .env
```

**Bot Not Responding**
- Verify BOT_TOKEN is correct
- Check bot has necessary permissions
- Review logs for error messages

### Debug Mode
```bash
NODE_ENV=development npm run dev
```

## 📊 Monitoring

The bot includes built-in monitoring:
- Queue job statistics via `/admin_stats`
- Database connection health checks
- Error logging with stack traces
- Graceful shutdown handling

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact [@your_support_handle](https://t.me/your_support_handle)
- Join our [Telegram Group](https://t.me/your_support_group)

---

Built with ❤️ for the crypto community 🚀
