# 🏗️ Project Structure

## Directory Layout

```
matchmakingbot/
├── src/
│   ├── bot/                    # Bot core and handlers
│   │   ├── bot.ts             # Main bot setup with grammY
│   │   ├── commands.ts        # Command handlers (/start, /help, etc.)
│   │   └── conversations/     # Multi-step conversation flows
│   │       ├── onboarding.ts  # Project registration flow
│   │       └── browsing.ts    # Project browsing/swiping flow
│   ├── database/              # Database layer
│   │   ├── connection.ts      # PostgreSQL connection pool
│   │   ├── migrate.ts         # Database migration runner
│   │   └── schema.sql         # Database schema definition
│   ├── services/              # Business logic services
│   │   ├── database.ts        # Database operations (CRUD)
│   │   ├── blockchain.ts      # Contract verification service
│   │   └── notifications.ts  # Direct notification handling
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts          # All interfaces and enums
│   └── index.ts              # Main application entry point
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── env.example              # Environment variables template
├── setup.sh                 # Automated setup script
├── README.md                # Comprehensive documentation
└── STRUCTURE.md             # This file
```

## Key Components

### 🤖 Bot Layer (`src/bot/`)
- **bot.ts**: grammY setup, middleware, main menu
- **commands.ts**: Slash commands and admin functions
- **conversations/**: Multi-step user interactions using grammY conversations

### 🗄️ Database Layer (`src/database/`)
- **MongoDB** with Mongoose ODM
- **ObjectId primary keys** for better scalability
- **Automatic timestamps** and optimized indexes
- **Schema validation** and initialization system

### 🔧 Services Layer (`src/services/`)
- **database.ts**: Clean CRUD operations with proper typing
- **blockchain.ts**: Multi-chain contract verification
- **notifications.ts**: Direct notification and processing service

## Data Flow

### 1. Project Registration
```
User → /start → Onboarding Conversation → Database → Direct Verification
```

### 2. Project Discovery
```
User → Browse → Database Query → Card Display → Like/Pass → Match Check
```

### 3. Match Creation
```
Mutual Like Detected → Match Record → Direct Announcement → Direct Group Creation
```

### 4. Direct Processing
```
Match/Verification → Notification Service → Telegram API → Database Updates
```

## Key Features

### 🎯 Conversation Management
- **Multi-step forms** with validation
- **Inline keyboards** for selections
- **Error handling** and retry logic
- **Cancel/restart** capabilities

### 🔍 Smart Matching
- **Mutual like detection** with database constraints
- **Project filtering** (already liked, inactive projects)
- **Category-based** recommendations
- **Real-time** match notifications

### 📊 Direct Processing
- **Immediate execution** of notifications
- **Real-time processing** of matches and verifications
- **Error handling** with logging
- **Simplified architecture** without queue complexity

### 🔐 Security Features
- **Input validation** at all levels
- **SQL injection protection** with parameterized queries
- **Rate limiting** considerations
- **Environment-based** configuration

## Configuration

### Environment Variables
```env
# Core (Required)
BOT_TOKEN=              # From @BotFather
MONGODB_URI=            # MongoDB connection

# Blockchain APIs (Optional)
ETHERSCAN_API_KEY=     # Ethereum verification
POLYGONSCAN_API_KEY=   # Polygon verification
BSCSCAN_API_KEY=       # BSC verification
HELIUS_API_KEY=        # Solana verification

# Bot Settings
ANNOUNCEMENT_CHANNEL_ID=  # Where matches are announced
ADMIN_USER_ID=           # Admin commands access
MATCH_GROUP_TEMPLATE_ID= # Template for private groups
```

### Supported Chains
- **Ethereum**: Full verification via Etherscan
- **Polygon**: Full verification via Polygonscan
- **BSC**: Full verification via BSCScan
- **Solana**: Token verification via Helius
- **Arbitrum, Optimism, Base, Avalanche**: Basic validation

### Project Categories
- DeFi, NFT, Gaming, Infrastructure
- Social, Meme, AI, DAO
- Metaverse, Privacy

## Deployment

### Development
```bash
npm install
cp env.example .env  # Configure your settings
npm run migrate      # Setup database
npm run dev         # Start in development mode
```

### Production
```bash
npm run build       # Compile TypeScript
npm start          # Run compiled version
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
CMD ["npm", "start"]
```

## Monitoring

### Health Checks
- Database connection testing
- Redis queue status
- Bot API connectivity

### Logging
- Structured error logging
- Queue job monitoring
- User interaction tracking

### Admin Commands
- `/admin_stats` - View system statistics
- Queue job counts and status
- Database metrics

## Scalability Considerations

### Database
- Connection pooling with Mongoose
- Indexed queries for fast lookups
- ObjectId primary keys for distributed systems
- Document-based flexible schema

### Direct Processing
- Immediate notification handling
- Real-time match processing
- Simplified error handling

### Bot Performance
- Efficient conversation state management
- Minimal database queries per interaction
- Cached frequently accessed data

---

This structure provides a solid foundation for a production-ready Telegram bot with room for future enhancements and scaling.
