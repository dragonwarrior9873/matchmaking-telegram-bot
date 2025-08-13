import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export class Database {
private static instance: Database;
private isConnected = false;

private constructor() {}

public static getInstance(): Database {
if (!Database.instance) {
Database.instance = new Database();
}
return Database.instance;
}

public async connect(): Promise<boolean> {
try {
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/matchmaking_bot';

await mongoose.connect(mongoUri, {
// Connection options
maxPoolSize: 10, // Maintain up to 10 socket connections
serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
bufferCommands: false, // Disable mongoose buffering
});

this.isConnected = true;
console.log('✅ Connected to MongoDB successfully');
return true;
} catch (error) {
console.error('❌ MongoDB connection error:', error);
this.isConnected = false;
return false;
}
}

public async disconnect(): Promise<void> {
try {
if (this.isConnected) {
await mongoose.disconnect();
this.isConnected = false;
console.log('🔌 Disconnected from MongoDB');
}
} catch (error) {
console.error('❌ Error disconnecting from MongoDB:', error);
}
}

public async testConnection(): Promise<boolean> {
try {
if (!this.isConnected) {
await this.connect();
}

// Simple ping to test connection
await mongoose.connection.db?.admin().ping();
return true;
} catch (error) {
console.error('Database connection test failed:', error);
return false;
}
}

public getConnection() {
return mongoose.connection;
}

public isConnectionReady(): boolean {
return this.isConnected && mongoose.connection.readyState === 1;
}
}

// Handle connection events
mongoose.connection.on('connected', () => {
console.log(' Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
console.log('🔌 Mongoose disconnected from MongoDB');
});

// Handle process termination
process.on('SIGINT', async () => {
await mongoose.connection.close();
console.log('🛑 MongoDB connection closed due to application termination');
process.exit(0);
});

export const db = Database.getInstance();