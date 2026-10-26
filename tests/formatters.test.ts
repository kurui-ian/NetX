import {
  formatBytes,
  formatThroughputMbps,
  classifyLatency,
  signalDbmToPercent,
  isValidIpv4,
  isValidSubnetMask,
} from '../src/utils/formatters';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('\n--- 1. Testing formatBytes ---');
assert(formatBytes(0) === '0 B', '0 bytes formats to "0 B"');
assert(formatBytes(1024) === '1 KB', '1024 bytes formats to "1 KB"');
assert(formatBytes(1048576) === '1 MB', '1048576 bytes formats to "1 MB"');
assert(formatBytes(1073741824) === '1 GB', '1073741824 bytes formats to "1 GB"');
assert(formatBytes(5368709120) === '5 GB', '5368709120 bytes formats to "5 GB"');

console.log('\n--- 2. Testing formatThroughputMbps ---');
assert(formatThroughputMbps(0).value === '0.00' && formatThroughputMbps(0).unit === 'Mbps', '0 Mbps');
assert(formatThroughputMbps(94.5).value === '94.50' && formatThroughputMbps(94.5).unit === 'Mbps', '94.5 Mbps');
assert(formatThroughputMbps(1200).value === '1.20' && formatThroughputMbps(1200).unit === 'Gbps', '1200 Mbps to 1.20 Gbps');

console.log('\n--- 3. Testing classifyLatency ---');
assert(classifyLatency(12) === 'excellent', '12ms is excellent');
assert(classifyLatency(45) === 'good', '45ms is good');
assert(classifyLatency(95) === 'fair', '95ms is fair');
assert(classifyLatency(180) === 'poor', '180ms is poor');
assert(classifyLatency(0) === 'critical', '0ms is critical');

console.log('\n--- 4. Testing signalDbmToPercent ---');
assert(signalDbmToPercent(-50) === 100, '-50 dBm is 100%');
assert(signalDbmToPercent(-75) === 50, '-75 dBm is 50%');
assert(signalDbmToPercent(-100) === 0, '-100 dBm is 0%');

console.log('\n--- 5. Testing IPv4 and Subnet Validation ---');
assert(isValidIpv4('192.168.1.1') === true, 'Valid local IPv4');
assert(isValidIpv4('1.1.1.1') === true, 'Valid public IPv4');
assert(isValidIpv4('256.0.0.1') === false, 'Invalid octet 256');
assert(isValidIpv4('abc.def.ghi.jkl') === false, 'Invalid non-numeric IP');
assert(isValidSubnetMask('255.255.255.0') === true, 'Standard /24 subnet mask is valid');
assert(isValidSubnetMask('255.255.0.0') === true, 'Standard /16 subnet mask is valid');
assert(isValidSubnetMask('255.255.255.123') === false, 'Invalid subnet mask octet');

console.log('\n🎉 ALL FORMATTER UNIT TESTS PASSED!\n');
