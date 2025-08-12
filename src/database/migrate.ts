import { db } from './connection';
import { 
  ProjectModel, 
  AdminModel, 
  ProjectLikeModel, 
  MatchModel, 
  MatchGroupModel 
} from './models';

async function initializeDatabase() {
  try {
    console.log('🚀 Starting MongoDB initialization...');
    
    // Connect to database
    const isConnected = await db.connect();
    if (!isConnected) {
      throw new Error('Failed to connect to MongoDB');
    }
    
    console.log('📊 Creating indexes...');
    
    // Create indexes for all models
    // This ensures all indexes defined in schemas are created
    await Promise.all([
      ProjectModel.createIndexes(),
      AdminModel.createIndexes(),
      ProjectLikeModel.createIndexes(),
      MatchModel.createIndexes(),
      MatchGroupModel.createIndexes()
    ]);
    
    console.log('✅ Indexes created successfully');
    
    // Test database operations
    console.log('🧪 Testing database operations...');
    
    // Test connection
    const isHealthy = await db.testConnection();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    
    console.log('✅ Database health check passed');
    
    // Display collection information
    const collections = await db.getConnection().db?.listCollections().toArray() || [];
    console.log('📋 Available collections:');
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });
    
    console.log('🎉 MongoDB initialization completed successfully!');
    
    // Disconnect after initialization
    await db.disconnect();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB initialization failed:', error);
    process.exit(1);
  }
}

// Seed data function for development/testing
async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with sample data...');
    
    // Connect to database
    const isConnected = await db.connect();
    if (!isConnected) {
      throw new Error('Failed to connect to MongoDB');
    }
    
    // Clear existing data (only for development)
    if (process.env.NODE_ENV === 'development') {
      await Promise.all([
        ProjectModel.deleteMany({}),
        AdminModel.deleteMany({}),
        ProjectLikeModel.deleteMany({}),
        MatchModel.deleteMany({}),
        MatchGroupModel.deleteMany({})
      ]);
      console.log('🧹 Cleared existing data');
    }
    
    // Create sample projects
    const sampleProjects = [
      {
        name: 'DeFi Protocol',
        contract_address: '0x1234567890123456789012345678901234567890',
        chains: ['ethereum', 'polygon'],
        categories: ['defi'],
        admin_handles: ['defiprotocol_admin'],
        is_active: true,
        verified: true
      },
      {
        name: 'NFT Marketplace',
        contract_address: '0x2345678901234567890123456789012345678901',
        chains: ['ethereum'],
        categories: ['nft', 'marketplace'],
        admin_handles: ['nft_marketplace_admin'],
        is_active: true,
        verified: false
      },
      {
        name: 'Gaming Token',
        contract_address: '0x3456789012345678901234567890123456789012',
        chains: ['polygon', 'bsc'],
        categories: ['gaming'],
        admin_handles: ['gaming_token_admin'],
        is_active: true,
        verified: true
      }
    ];
    
    const createdProjects = await ProjectModel.insertMany(sampleProjects);
    console.log(`✅ Created ${createdProjects.length} sample projects`);
    
    // Create sample admins
    const sampleAdmins = [
      {
        telegram_id: 123456789,
        username: 'defi_admin',
        first_name: 'DeFi',
        last_name: 'Admin',
        project_id: createdProjects[0]._id
      },
      {
        telegram_id: 987654321,
        username: 'nft_admin',
        first_name: 'NFT',
        last_name: 'Admin',
        project_id: createdProjects[1]._id
      }
    ];
    
    const createdAdmins = await AdminModel.insertMany(sampleAdmins);
    console.log(`✅ Created ${createdAdmins.length} sample admins`);
    
    console.log('🌱 Database seeding completed!');
    
    // Disconnect after seeding
    await db.disconnect();
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'seed') {
    seedDatabase().catch(console.error);
  } else {
    initializeDatabase();
  }
}

export { initializeDatabase, seedDatabase };