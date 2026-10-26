#!/usr/bin/env node

/**
 * NetX Telemetry CLI Benchmark
 * Samples Windows interface adapter throughput and ICMP gateway latency in the terminal.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execAsync = promisify(exec);

async function runCliBenchmark() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       NetX Windows Network Telemetry CLI         ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Host: ${os.hostname()} | Platform: ${os.platform()} (${os.arch()})\n`);

  console.log('1. Reading active IPv4 configuration...');
  let defaultGateway = '1.1.1.1';
  try {
    const { stdout } = await execAsync('netsh interface ip show config');
    const gwMatch = stdout.match(/Default Gateway\s*:\s*([0-9.]+)/i);
    if (gwMatch && gwMatch[1]) {
      defaultGateway = gwMatch[1];
      console.log(`   ✓ Active Gateway: ${defaultGateway}`);
    }
  } catch (err) {
    console.log('   ! Could not read gateway:', err.message);
  }

  console.log('\n2. Testing Gateway ICMP Ping...');
  const t0 = Date.now();
  try {
    const { stdout } = await execAsync(`ping -n 1 -w 1200 ${defaultGateway}`);
    const timeMatch = stdout.match(/time[=<](\d+)ms/i);
    const ms = timeMatch ? timeMatch[1] : (Date.now() - t0);
    console.log(`   ✓ Gateway Round-trip: ${ms} ms`);
  } catch (err) {
    console.log('   ✗ Gateway ping failed');
  }

  console.log('\n3. Testing DNS Edge ICMP Ping (1.1.1.1)...');
  const t1 = Date.now();
  try {
    const { stdout } = await execAsync('ping -n 1 -w 1200 1.1.1.1');
    const timeMatch = stdout.match(/time[=<](\d+)ms/i);
    const ms = timeMatch ? timeMatch[1] : (Date.now() - t1);
    console.log(`   ✓ Cloudflare Anycast DNS (1.1.1.1): ${ms} ms`);
  } catch (err) {
    console.log('   ✗ 1.1.1.1 ping failed');
  }

  console.log('\n4. Sampling Interface Byte Counters...');
  try {
    const { stdout: netstatOut } = await execAsync('netstat -e');
    const lines = netstatOut.split(/\r?\n/).filter(Boolean);
    const byteLine = lines.find((l) => l.includes('Bytes'));
    if (byteLine) {
      console.log(`   ✓ ${byteLine.trim()}`);
    }
  } catch (err) {
    console.log('   ! netstat -e failed:', err.message);
  }

  console.log('\n✅ Telemetry CLI benchmark completed successfully.');
}

runCliBenchmark().catch(console.error);
