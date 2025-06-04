const { RuuviDecoder } = require('../dist/ruuvi-decoder');

console.log('🧪 Testing Ruuvi Data Format 5 Decoder...\n');

// Real Ruuvi Gateway payload for testing (obfuscated MAC addresses)
const realGatewayPayload = {
  name: 'Real Gateway Payload',
  gatewayData: {
    "gw_mac": "A1:B2:C3:D4:E5:F6",
    "rssi": -62,
    "aoa": [],
    "gwts": 1728719836,
    "ts": 1728719836,
    "data": "0201061BFF9904050F18FFFFFFFFFFF0FFEC0414AA96A8DE8E123456789ABC",
    "coords": ""
  },
  // Extract Ruuvi hex from BLE data: after "9904" marker
  hex: '050F18FFFFFFFFFFF0FFEC0414AA96A8DE8E123456789ABC',
  expected: {
    dataFormat: 5,
    temperature: 19.32,
    humidity: null,
    pressure: null,
    mac: '123456789abc',
    batteryVoltage: 2964,
    txPower: 4,
    movementCounter: 168,
    measurementSequence: 56974,
    accelerationX: -16,
    accelerationY: -20,
    accelerationZ: 1044
  }
};

// Test vectors from official Ruuvi documentation
const testVectors = [
  realGatewayPayload,
  {
    name: 'Valid data',
    hex: '0512FC5394C37C0004FFFC040CAC364200CDAABBCCDDEEFF',
    expected: {
      dataFormat: 5,
      temperature: 24.3,
      humidity: 53.49,
      pressure: 1000.44,
      mac: 'aabbccddeeff'
    }
  },
  {
    name: 'Invalid values',
    hex: '058000FFFFFFFF800080008000FFFFFFFFFFFFFFFFFFFFFF',
    expected: {
      dataFormat: 5,
      temperature: null,
      humidity: null,
      pressure: null,
      mac: 'ffffffffffff'
    }
  }
];

function compareValues(actual, expected, tolerance = 0.01) {
  if (expected === null) return actual === null;
  if (actual === null) return false;
  if (typeof expected === 'string') return actual === expected;
  return Math.abs(actual - expected) < tolerance;
}

// Helper function to extract Ruuvi data from BLE advertisement
function extractRuuviFromBLE(bleData) {
  const ruuviMarker = '9904';
  const markerIndex = bleData.indexOf(ruuviMarker);
  
  if (markerIndex === -1) {
    return null;
  }
  
  const ruuviStart = markerIndex + ruuviMarker.length;
  const ruuviPayload = bleData.slice(ruuviStart, ruuviStart + 48);
  
  if (ruuviPayload.length !== 48) {
    return null;
  }
  
  return ruuviPayload;
}

let passed = 0;
let failed = 0;

testVectors.forEach(test => {
  console.log(`📝 Testing: ${test.name}`);
  
  // Test BLE extraction for gateway payload
  let hexToTest = test.hex;
  if (test.gatewayData) {
    const extractedHex = extractRuuviFromBLE(test.gatewayData.data);
    if (!extractedHex) {
      console.log(`❌ Failed to extract Ruuvi data from BLE advertisement`);
      failed++;
      return;
    }
    console.log(`🔍 Extracted hex: ${extractedHex}`);
    hexToTest = extractedHex;
  }
  
  const result = RuuviDecoder.decode(hexToTest);
  
  if (!result) {
    console.log(`❌ Failed to decode data`);
    failed++;
    return;
  }
  
  let testPassed = true;
  
  // Check data format
  if (result.dataFormat !== test.expected.dataFormat) {
    console.log(`❌ Data format mismatch: ${result.dataFormat} !== ${test.expected.dataFormat}`);
    testPassed = false;
  }
  
  // Check temperature
  if (!compareValues(result.temperature, test.expected.temperature)) {
    console.log(`❌ Temperature mismatch: ${result.temperature} !== ${test.expected.temperature}`);
    testPassed = false;
  }
  
  // Check humidity  
  if (!compareValues(result.humidity, test.expected.humidity)) {
    console.log(`❌ Humidity mismatch: ${result.humidity} !== ${test.expected.humidity}`);
    testPassed = false;
  }
  
  // Check pressure (if expected is defined)
  if (test.expected.pressure !== undefined && !compareValues(result.pressure, test.expected.pressure, 1)) {
    console.log(`❌ Pressure mismatch: ${result.pressure} !== ${test.expected.pressure}`);
    testPassed = false;
  }
  
  // Check MAC
  if (!compareValues(result.mac, test.expected.mac)) {
    console.log(`❌ MAC mismatch: ${result.mac} !== ${test.expected.mac}`);
    testPassed = false;
  }
  
  // Check battery voltage (if expected)
  if (test.expected.batteryVoltage !== undefined && !compareValues(result.batteryVoltage, test.expected.batteryVoltage, 1)) {
    console.log(`❌ Battery voltage mismatch: ${result.batteryVoltage} !== ${test.expected.batteryVoltage}`);
    testPassed = false;
  }
  
  // Check TX power (if expected)
  if (test.expected.txPower !== undefined && !compareValues(result.txPower, test.expected.txPower)) {
    console.log(`❌ TX power mismatch: ${result.txPower} !== ${test.expected.txPower}`);
    testPassed = false;
  }
  
  // Check movement counter (if expected)
  if (test.expected.movementCounter !== undefined && !compareValues(result.movementCounter, test.expected.movementCounter)) {
    console.log(`❌ Movement counter mismatch: ${result.movementCounter} !== ${test.expected.movementCounter}`);
    testPassed = false;
  }
  
  // Check measurement sequence (if expected)
  if (test.expected.measurementSequence !== undefined && !compareValues(result.measurementSequence, test.expected.measurementSequence)) {
    console.log(`❌ Measurement sequence mismatch: ${result.measurementSequence} !== ${test.expected.measurementSequence}`);
    testPassed = false;
  }
  
  // Check accelerations (if expected)
  if (test.expected.accelerationX !== undefined && !compareValues(result.accelerationX, test.expected.accelerationX)) {
    console.log(`❌ Acceleration X mismatch: ${result.accelerationX} !== ${test.expected.accelerationX}`);
    testPassed = false;
  }
  
  if (test.expected.accelerationY !== undefined && !compareValues(result.accelerationY, test.expected.accelerationY)) {
    console.log(`❌ Acceleration Y mismatch: ${result.accelerationY} !== ${test.expected.accelerationY}`);
    testPassed = false;
  }
  
  if (test.expected.accelerationZ !== undefined && !compareValues(result.accelerationZ, test.expected.accelerationZ)) {
    console.log(`❌ Acceleration Z mismatch: ${result.accelerationZ} !== ${test.expected.accelerationZ}`);
    testPassed = false;
  }
  
  if (testPassed) {
    console.log(`✅ ${test.name} passed`);
    console.log(`📊 Decoded: temp=${result.temperature}°C, hum=${result.humidity}%, mac=${result.mac}`);
    passed++;
  } else {
    console.log(`❌ ${test.name} failed`);
    failed++;
  }
  
  console.log('');
});

console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All decoder tests passed!');
  process.exit(0);
} else {
  console.log('💥 Some tests failed');
  process.exit(1);
}