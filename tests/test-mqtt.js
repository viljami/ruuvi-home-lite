const mqtt = require('mqtt');
const WebSocket = require('ws');

console.log('🧪 Testing Ruuvi Home Setup...\n');

// Test MQTT Connection
function testMQTT() {
  return new Promise((resolve, reject) => {
    console.log('📡 Testing MQTT connection...');
    
    const client = mqtt.connect('mqtts://localhost:8883', {
      username: 'ruuvi',
      password: process.env.MQTT_PASS || 'ruuvi123',
      rejectUnauthorized: false
    });

    client.on('connect', () => {
      console.log('✅ MQTT connection successful');
      
      // Send test data - Real Gateway JSON format (obfuscated MAC addresses)
      const testGatewayData = {
        "gw_mac": "A1:B2:C3:D4:E5:F6",
        "rssi": -62,
        "aoa": [],
        "gwts": Date.now(),
        "ts": Date.now(),
        "data": "0201061BFF9904050F18FFFFFFFFFFF0FFEC0414AA96A8DE8E123456789ABC",
        "coords": ""
      };
      
      client.publish('ruuvi/TEST_GATEWAY/123456789abc', JSON.stringify(testGatewayData), { qos: 1 }, (err) => {
        if (err) {
          console.log('❌ MQTT publish failed:', err.message);
          reject(err);
        } else {
          console.log('✅ MQTT publish successful');
          client.end();
          resolve();
        }
      });
    });

    client.on('error', (err) => {
      console.log('❌ MQTT connection failed:', err.message);
      reject(err);
    });

    setTimeout(() => {
      reject(new Error('MQTT connection timeout'));
    }, 5000);
  });
}

// Test WebSocket Connection
function testWebSocket() {
  return new Promise((resolve, reject) => {
    console.log('📡 Testing WebSocket connection...');
    
    const ws = new WebSocket('wss://localhost:3000', {
      rejectUnauthorized: false
    });

    ws.on('open', () => {
      console.log('✅ WebSocket connection successful');
      ws.send(JSON.stringify({ type: 'getData', timeRange: 'day' }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      console.log('✅ WebSocket message received:', msg.type);
      ws.close();
      resolve();
    });

    ws.on('error', (err) => {
      console.log('❌ WebSocket connection failed:', err.message);
      reject(err);
    });

    setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 5000);
  });
}

// Run tests
async function runTests() {
  try {
    await testMQTT();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for server processing
    await testWebSocket();
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Make sure setup.sh has been run');
    console.log('2. Load environment: source .env');
    console.log('3. Check if Mosquitto is running: sudo systemctl status mosquitto');
    console.log('4. Check if the server is running: make logs');
    process.exit(1);
  }
}

runTests();