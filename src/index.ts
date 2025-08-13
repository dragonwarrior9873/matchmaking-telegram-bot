import dotenv from 'dotenv';
import { bot } from './bot/bot';
import { db } from './database/connection';

// Import commands to register them
import './bot/commands';

dotenv.config();

async function startBot() {
try {
console.log(' Starting Matchmaking Bot...');

// Connect to MongoDB
console.log(' Connecting to MongoDB...');
const isDbConnected = await db.connect();
if (!isDbConnected) {
throw new Error('Failed to connect to MongoDB');
}
console.log('✅ MongoDB connected successfully');

// Get bot info
const botInfo = await bot.api.getMe();
console.log(` Bot info: @${botInfo.username} (${botInfo.first_name})`);

// Set bot commands for better UX
await bot.api.setMyCommands([
{ command: 'start', description: 'Start the bot and show main menu' },
{ command: 'help', description: 'Show help information' },
{ command: 'menu', description: 'Show main menu' },
{ command: 'status', description: 'Check your registration status' },
{ command: 'matches', description: 'View your project matches' },
]);

// Start the bot
await bot.start({
onStart: (botInfo) => {
console.log(` Bot @${botInfo.username} started successfully!`);
console.log(' Ready to help projects find their perfect match!');
},
});

} catch (error) {
console.error('❌ Failed to start bot:', error);
process.exit(1);
}
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
console.log('\n🛑 Received SIGINT, shutting down gracefully...');

try {
await bot.stop();
await db.disconnect();
console.log('✅ Bot stopped successfully');
process.exit(0);
} catch (error) {
console.error('❌ Error during shutdown:', error);
process.exit(1);
}
});

process.on('SIGTERM', async () => {
console.log('\n🛑 Received SIGTERM, shutting down gracefully...');

try {
await bot.stop();
await db.disconnect();
console.log('✅ Bot stopped successfully');
process.exit(0);
} catch (error) {
console.error('❌ Error during shutdown:', error);
process.exit(1);
}
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
console.error('Uncaught Exception:', error);
process.exit(1);
});

// Start the bot
if (require.main === module) {
startBot();
}

export { bot };
