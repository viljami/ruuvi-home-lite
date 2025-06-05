const { Database } = require('./dist/db');
const sqlite3 = require('sqlite3');
const fs = require('fs');

async function testMigrations() {
  console.log('🧪 Testing migration system...');
  
  const testDbPath = 'test-ruuvi.db';
  
  // Clean up any existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    console.log('🧹 Cleaned up existing test database');
  }
  
  let database;
  
  try {
    // Test 1: Create database and run migrations
    console.log('\n📝 Test 1: Database initialization with migrations');
    database = new Database(testDbPath);
    await database.initialize();
    console.log('✅ Database initialized successfully');
    
    // Test 2: Check migration status
    console.log('\n📝 Test 2: Check migration status');
    const status = await database.getMigrationStatus();
    console.log(`Applied migrations: ${status.appliedMigrations.length}`);
    console.log(`Pending migrations: ${status.pendingMigrations.length}`);
    console.log(`Up to date: ${status.isUpToDate}`);
    
    if (!status.isUpToDate) {
      throw new Error('Database should be up to date after initialization');
    }
    console.log('✅ Migration status check passed');
    
    // Test 3: Check database health
    console.log('\n📝 Test 3: Database health check');
    const isHealthy = await database.checkDatabaseHealth();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    console.log('✅ Database health check passed');
    
    // Test 4: Test table exists and can insert data
    console.log('\n📝 Test 4: Test sensor_data table functionality');
    const testData = {
      sensorMac: 'AA:BB:CC:DD:EE:FF',
      temperature: 23.5,
      humidity: 45.2,
      timestamp: Date.now(),
      pressure: 1013.25,
      batteryVoltage: 3000,
      txPower: 4,
      movementCounter: 100,
      measurementSequence: 1,
      accelerationX: 0.1,
      accelerationY: 0.2,
      accelerationZ: 9.8
    };
    
    database.saveSensorData(testData);
    console.log('✅ Test data inserted successfully');
    
    // Test 5: Test data retrieval
    console.log('\n📝 Test 5: Test data retrieval');
    const historicalData = await database.getHistoricalData('day');
    if (historicalData.length === 0) {
      throw new Error('No data retrieved from database');
    }
    console.log(`✅ Retrieved ${historicalData.length} records`);
    
    console.log('\n🎉 All migration tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (database) {
      database.close();
    }
    
    // Remove test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('🧹 Test database cleaned up');
    }
  }
}

// Test server startup simulation
async function testServerStartup() {
  console.log('\n🚀 Testing server startup simulation...');
  
  const testDbPath = 'test-server.db';
  
  // Clean up any existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  let database;
  
  try {
    // Simulate server startup process
    console.log('📝 Simulating server startup with fresh database...');
    
    // This simulates what happens in server.ts
    database = new Database(testDbPath);
    await database.initialize();
    
    console.log('✅ Server startup simulation successful');
    
    // Verify the database is ready for use
    const status = await database.getMigrationStatus();
    if (!status.isUpToDate) {
      throw new Error('Database not ready after server startup');
    }
    
    console.log('✅ Database ready for sensor data');
    
  } catch (error) {
    console.error('❌ Server startup simulation failed:', error);
    process.exit(1);
  } finally {
    if (database) {
      database.close();
    }
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

async function main() {
  console.log('🧪 Ruuvi Migration System Test Suite');
  console.log('====================================');
  
  await testMigrations();
  await testServerStartup();
  
  console.log('\n🎊 All tests completed successfully!');
  console.log('\n💡 Migration system is working correctly.');
  console.log('   - Fresh databases will automatically run migrations');
  console.log('   - Existing databases will be checked and updated');
  console.log('   - Use npm run migrate:status to check migration status');
  console.log('   - Use npm run migrate to manually run migrations');
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}