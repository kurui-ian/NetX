/**
 * NetX Common Network & Telemetry Formatting Utilities
 */

/**
 * Format raw bytes into human-readable strings (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

/**
 * Format throughput rate into Mbps or Gbps
 */
export function formatThroughputMbps(mbps: number): { value: string; unit: string } {
  if (!Number.isFinite(mbps) || mbps <= 0) {
    return { value: '0.00', unit: 'Mbps' };
  }
  if (mbps >= 1000) {
    return { value: (mbps / 1000).toFixed(2), unit: 'Gbps' };
  }
  return { value: mbps.toFixed(2), unit: 'Mbps' };
}

/**
 * Classify round-trip latency into health tiers
 */
export function classifyLatency(pingMs: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (pingMs <= 0) return 'critical';
  if (pingMs < 25) return 'excellent';
  if (pingMs < 60) return 'good';
  if (pingMs < 120) return 'fair';
  if (pingMs < 250) return 'poor';
  return 'critical';
}

/**
 * Convert Wi-Fi RSSI (dBm) to approximate Signal Quality Percentage (0% to 100%)
 */
export function signalDbmToPercent(dbm: number): number {
  if (dbm <= -100) return 0;
  if (dbm >= -50) return 100;
  return Math.round(2 * (dbm + 100));
}

/**
 * Validate an IPv4 string format (dotted decimal 0.0.0.0 to 255.255.255.255)
 */
export function isValidIpv4(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const num = parseInt(p, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Validate standard IPv4 Subnet Mask
 */
export function isValidSubnetMask(mask: string): boolean {
  if (!isValidIpv4(mask)) return false;
  const validMaskOctets = new Set([0, 128, 192, 224, 240, 248, 252, 254, 255]);
  const octets = mask.trim().split('.').map(Number);
  let foundZero = false;
  for (const o of octets) {
    if (!validMaskOctets.has(o)) return false;
    if (foundZero && o !== 0) return false;
    if (o < 255) foundZero = true;
  }
  return true;
}
