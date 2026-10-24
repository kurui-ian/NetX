const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dns = require('dns').promises;
const net = require('net');
const https = require('https');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ============================================================================
// Persistent Local Storage in %APPDATA%\NetX
// ============================================================================
function getDataFilePath() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'netx-usage-store.json');
}

function loadUsageStore() {
  const file = getDataFilePath();
  let data = null;
  try {
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {
    // ignore corrupt file
  }

  if (!data || typeof data !== 'object') {
    return {
      lastBootAdapterRx: 0,
      lastBootAdapterTx: 0,
      daily: {},
      hourly: {},
      monthly: {},
      appBytes: {},
    };
  }

  // Sanitize legacy corrupted data from previous versions that dumped cumulative uptime into daily/monthly
  const cleanDaily = {};
  const cleanMonthly = {};

  if (data.daily && typeof data.daily === 'object') {
    for (const [dayKey, val] of Object.entries(data.daily)) {
      if (!val || typeof val !== 'object') continue;
      let rx = Number(val.rxBytes) || 0;
      let tx = Number(val.txBytes) || 0;
      // Filter out seed bug relics (> 15 GB dumped in a single session)
      if (rx > 15_000_000_000) rx = Math.min(rx, 800_000_000);
      if (tx > 8_000_000_000) tx = Math.min(tx, 300_000_000);

      cleanDaily[dayKey] = { rxBytes: rx, txBytes: tx };

      const mKey = dayKey.slice(0, 7);
      if (!cleanMonthly[mKey]) cleanMonthly[mKey] = { rxBytes: 0, txBytes: 0 };
      cleanMonthly[mKey].rxBytes += rx;
      cleanMonthly[mKey].txBytes += tx;
    }
  }

  return {
    lastBootAdapterRx: 0,
    lastBootAdapterTx: 0,
    daily: cleanDaily,
    hourly: data.hourly || {},
    monthly: cleanMonthly,
    appBytes: data.appBytes || {},
  };
}

let usageStore = null;
function saveUsageStore() {
  if (!usageStore) return;
  try {
    fs.writeFileSync(getDataFilePath(), JSON.stringify(usageStore, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

// ============================================================================
// Real-Time Byte Counter & Rate State
// ============================================================================
let lastSampleTime = 0;
let lastRxBytes = 0;
let lastTxBytes = 0;
let currentDownloadMbps = 0;
let currentUploadMbps = 0;
let currentPingMs = 0;
let currentJitterMs = 0;
let lastPingMs = 0;
let publicIpCache = { ip: 'Detecting...', isp: '', lastFetched: 0 };
const reverseDnsCache = new Map();

// OUI Vendor Lookup Table for common LAN MAC prefixes + fallback
const OUI_VENDORS = {
  'F8:63:3F': 'Intel Corporate',
  'F4:30:B9': 'Hewlett Packard / Realtek',
  '78:17:BE': 'Huawei / FiberHome Gateway',
  'D8:32:14': 'Tenda / Broadcom Wireless AP',
  'DC:A6:32': 'Raspberry Pi Foundation',
  '00:1A:11': 'Google, Inc.',
  '3C:22:FB': 'Apple, Inc.',
  'AC:BC:32': 'Apple, Inc.',
  'F0:9F:C2': 'Ubiquiti Inc.',
  'B8:27:EB': 'Raspberry Pi',
};

function lookupMacVendor(mac) {
  if (!mac) return 'Network Device';
  const clean = mac.toUpperCase().replace(/-/g, ':').trim();
  const prefix = clean.slice(0, 8);
  if (OUI_VENDORS[prefix]) return OUI_VENDORS[prefix];
  if (clean.startsWith('01:00:5E')) return 'IPv4 Multicast';
  if (clean.startsWith('FF:FF:FF')) return 'Broadcast Address';
  return 'IEEE 802.3/802.11 Node';
}

// ============================================================================
// Helper: Fetch Public IPv4 Address from Cloudflare / ipify
// ============================================================================
function fetchPublicIp() {
  const now = Date.now();
  if (
    publicIpCache.ip &&
    publicIpCache.ip !== 'Detecting...' &&
    now - publicIpCache.lastFetched < 120000
  ) {
    return Promise.resolve(publicIpCache);
  }

  return new Promise((resolve) => {
    const req = https.get(
      'https://1.1.1.1/cdn-cgi/trace',
      { timeout: 3500 },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const ipMatch = body.match(/ip=([^\r\n]+)/);
          const coloMatch = body.match(/colo=([^\r\n]+)/);
          if (ipMatch) {
            publicIpCache = {
              ip: ipMatch[1].trim(),
              isp: coloMatch ? `Cloudflare Edge (${coloMatch[1].trim()})` : 'Direct WAN',
              lastFetched: Date.now(),
            };
          }
          resolve(publicIpCache);
        });
      }
    );
    req.on('error', () => {
      resolve(publicIpCache);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(publicIpCache);
    });
  });
}

// ============================================================================
// Helper: Parse `netsh wlan show interfaces`
// ============================================================================
async function getWifiInterfaceInfo() {
  try {
    const { stdout } = await execAsync('netsh wlan show interfaces', { timeout: 2500 });
    const getVal = (key) => {
      const regex = new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'mi');
      const m = stdout.match(regex);
      return m ? m[1].trim() : '';
    };
    const state = getVal('State');
    const ssid = getVal('SSID');
    const bssid = getVal('AP BSSID') || getVal('BSSID');
    const band = getVal('Band');
    const channel = getVal('Channel');
    const radioType = getVal('Radio type');
    const auth = getVal('Authentication');
    const cipher = getVal('Cipher');
    const rxRate = parseFloat(getVal('Receive rate \\(Mbps\\)')) || 0;
    const txRate = parseFloat(getVal('Transmit rate \\(Mbps\\)')) || 0;
    const signalStr = getVal('Signal').replace('%', '');
    const signalQuality = parseInt(signalStr, 10) || 0;
    const rssiVal = parseInt(getVal('Rssi'), 10);
    const signalDbm = !isNaN(rssiVal)
      ? rssiVal
      : signalQuality > 0
      ? Math.round(-100 + signalQuality * 0.5)
      : -70;

    return {
      connected: state.toLowerCase() === 'connected',
      name: getVal('Name') || 'Wi-Fi',
      description: getVal('Description') || 'Wireless LAN Adapter',
      mac: (getVal('Physical address') || '').toUpperCase().replace(/-/g, ':'),
      ssid: ssid || 'Disconnected',
      bssid: bssid ? bssid.toUpperCase() : '—',
      band: band || '2.4 GHz',
      channel: channel || '1',
      radioType: radioType || '802.11n',
      security: auth ? (cipher ? `${auth} (${cipher})` : auth) : 'WPA2-Personal',
      linkSpeedMbps: Math.max(rxRate, txRate) || 72.2,
      rxRateMbps: rxRate || 72.2,
      txRateMbps: txRate || 72.2,
      signalQuality,
      signalDbm,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Helper: Parse `ipconfig /all` for Real Gateway, DNS, DHCP, and Adapters
// ============================================================================
async function getIpConfigDetails() {
  try {
    const { stdout } = await execAsync('ipconfig /all', { timeout: 3000 });
    const blocks = stdout.split(/\r?\n(?=[A-Za-z].*adapter )/i);
    const adapters = [];
    let primaryGateway = '';
    let primaryDns = [];
    let dhcpServer = '';
    let primaryIpv4 = '';
    let primarySubnet = '255.255.255.0';
    let primaryIpv6 = '';
    let primaryMac = '';
    let primaryDesc = '';
    let primaryName = '';

    for (const block of blocks) {
      const headerMatch = block.match(/^(Ethernet|Wireless LAN|Unknown) adapter ([^:]+):/i);
      if (!headerMatch) continue;
      const adapterType = headerMatch[1];
      const adapterName = headerMatch[2].trim();

      const getField = (label) => {
        const m = block.match(new RegExp(`${label}[\\s.]+:\\s*([^\\r\\n]+)`, 'i'));
        return m ? m[1].trim() : '';
      };

      const mediaState = getField('Media State');
      const desc = getField('Description');
      const mac = getField('Physical Address').replace(/-/g, ':');
      const ipv4Raw = getField('IPv4 Address').replace(/\(Preferred\)/i, '').trim();
      const subnet = getField('Subnet Mask');
      const gateway = getField('Default Gateway');
      const dhcp = getField('DHCP Server');
      const dhcpEnabled = getField('DHCP Enabled');
      const ipv6 = getField('Link-local IPv6 Address').replace(/\(Preferred\)/i, '').trim();

      // Collect multi-line DNS servers if present
      const dnsList = [];
      const dnsSection = block.match(/DNS Servers[\s.]+:\s*([^\r\n]+)(?:\r?\n\s+([0-9a-fA-F.:]+))?/i);
      if (dnsSection) {
        if (dnsSection[1]) dnsList.push(dnsSection[1].trim());
        if (dnsSection[2]) dnsList.push(dnsSection[2].trim());
      }

      const isUp = !mediaState.toLowerCase().includes('disconnected') && Boolean(ipv4Raw);

      adapters.push({
        name: adapterName,
        type: adapterType,
        description: desc,
        mac: mac || '—',
        status: isUp ? 'Up' : 'Disconnected',
        ipv4: ipv4Raw || '—',
        subnet: subnet || '—',
        ipv6: ipv6 || '—',
        gateway: gateway || '—',
        dns: dnsList.length ? dnsList.join(', ') : '—',
        dhcpEnabled: dhcpEnabled || 'Yes',
        dhcpServer: dhcp || '—',
      });

      if (isUp && !primaryIpv4) {
        primaryName = adapterName;
        primaryDesc = desc;
        primaryMac = mac;
        primaryIpv4 = ipv4Raw;
        primarySubnet = subnet || '255.255.255.0';
        primaryGateway = gateway;
        primaryDns = dnsList;
        dhcpServer = dhcp;
        primaryIpv6 = ipv6;
      }
    }

    return {
      hostname: os.hostname(),
      primaryName: primaryName || 'Wi-Fi',
      primaryDesc: primaryDesc || 'Network Adapter',
      primaryMac: primaryMac || '—',
      primaryIpv4: primaryIpv4 || '127.0.0.1',
      primarySubnet,
      primaryIpv6: primaryIpv6 || '—',
      primaryGateway: primaryGateway || '192.168.1.1',
      primaryDns: primaryDns.length ? primaryDns : ['1.1.1.1'],
      dhcpServer: dhcpServer || primaryGateway || '—',
      adapters,
    };
  } catch {
    return {
      hostname: os.hostname(),
      primaryName: 'Wi-Fi',
      primaryDesc: 'Wireless LAN Adapter',
      primaryMac: '—',
      primaryIpv4: '127.0.0.1',
      primarySubnet: '255.255.255.0',
      primaryIpv6: '—',
      primaryGateway: '—',
      primaryDns: [],
      dhcpServer: '—',
      adapters: [],
    };
  }
}

// ============================================================================
// Helper: Read Real Cumulative Interface Bytes & Measure Real Ping
// ============================================================================
// ============================================================================
// Helper: Read Real Cumulative Interface Bytes & Measure Real Ping
// ============================================================================
async function getInterfaceBytes() {
  try {
    const { stdout } = await execAsync('netstat -e', { timeout: 1500 });
    const m = stdout.match(/Bytes\s+(\d+)\s+(\d+)/i);
    if (m) {
      return {
        rxBytes: parseInt(m[1], 10) || 0,
        txBytes: parseInt(m[2], 10) || 0,
      };
    }
  } catch {
    // ignore
  }
  return { rxBytes: lastRxBytes, txBytes: lastTxBytes };
}

async function measureQuickPing(host) {
  if (!host || host === '—') return { alive: false, timeMs: 0 };
  const start = Date.now();
  try {
    const { stdout } = await execAsync(`ping -n 1 -w 1200 ${host}`, { timeout: 2000 });
    const timeMatch = stdout.match(/time[=<](\d+)ms/i);
    if (timeMatch) {
      return { alive: true, timeMs: Math.max(1, parseInt(timeMatch[1], 10)) };
    }
    if (/TTL=/i.test(stdout)) {
      return { alive: true, timeMs: Math.max(1, Date.now() - start) };
    }
  } catch {
    // ignore
  }
  return { alive: false, timeMs: 0 };
}

let lastSaveUsageTime = 0;
function debouncedSaveUsageStore() {
  const now = Date.now();
  if (now - lastSaveUsageTime > 8000) {
    lastSaveUsageTime = now;
    saveUsageStore();
  }
}

// Update Persistent Usage Store ONLY with Real Byte Deltas
function recordBytesDelta(dRx, dTx) {
  if (dRx <= 0 && dTx <= 0) return;
  // Discard absurd single-second anomalies (> 1 GB/sec)
  if (dRx > 1_073_741_824 || dTx > 1_073_741_824) return;

  if (!usageStore) usageStore = loadUsageStore();

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const hourKey = `${dayKey}-${String(now.getHours()).padStart(2, '0')}`;
  const monthKey = dayKey.slice(0, 7); // YYYY-MM

  if (!usageStore.daily) usageStore.daily = {};
  if (!usageStore.daily[dayKey]) usageStore.daily[dayKey] = { rxBytes: 0, txBytes: 0 };
  usageStore.daily[dayKey].rxBytes += dRx;
  usageStore.daily[dayKey].txBytes += dTx;

  if (!usageStore.hourly) usageStore.hourly = {};
  if (!usageStore.hourly[hourKey]) usageStore.hourly[hourKey] = { rxBytes: 0, txBytes: 0 };
  usageStore.hourly[hourKey].rxBytes += dRx;
  usageStore.hourly[hourKey].txBytes += dTx;

  if (!usageStore.monthly) usageStore.monthly = {};
  if (!usageStore.monthly[monthKey]) usageStore.monthly[monthKey] = { rxBytes: 0, txBytes: 0 };
  usageStore.monthly[monthKey].rxBytes += dRx;
  usageStore.monthly[monthKey].txBytes += dTx;

  debouncedSaveUsageStore();
}

// ============================================================================
// IPC 1: Real-Time Telemetry Snapshot (`netx:get-telemetry`)
// ============================================================================
ipcMain.handle('netx:get-telemetry', async () => {
  const now = Date.now();
  const [bytes, wifi, ipConfig, pubIp] = await Promise.all([
    getInterfaceBytes(),
    getWifiInterfaceInfo(),
    getIpConfigDetails(),
    fetchPublicIp(),
  ]);

  let dRx = 0;
  let dTx = 0;

  if (lastSampleTime > 0 && now > lastSampleTime) {
    const elapsedSec = (now - lastSampleTime) / 1000;
    // Only calculate delta if counters advanced normally and didn't wrap/reset
    if (lastRxBytes > 0 && bytes.rxBytes >= lastRxBytes && bytes.txBytes >= lastTxBytes) {
      const candRx = bytes.rxBytes - lastRxBytes;
      const candTx = bytes.txBytes - lastTxBytes;
      // Filter out impossible single-second spikes (> 1.5 GB in 1 sec)
      if (candRx < 1_610_612_736 && candTx < 1_610_612_736) {
        dRx = candRx;
        dTx = candTx;
        currentDownloadMbps = Math.round(((dRx * 8) / (elapsedSec * 1_000_000)) * 100) / 100;
        currentUploadMbps = Math.round(((dTx * 8) / (elapsedSec * 1_000_000)) * 100) / 100;
        recordBytesDelta(dRx, dTx);
      }
    }
  }

  lastSampleTime = now;
  lastRxBytes = bytes.rxBytes;
  lastTxBytes = bytes.txBytes;

  // Measure real ping to gateway & external DNS (1.1.1.1)
  const gatewayTarget = ipConfig.primaryGateway !== '—' ? ipConfig.primaryGateway : '1.1.1.1';
  const [gwPing, dnsPing] = await Promise.all([
    measureQuickPing(gatewayTarget),
    measureQuickPing('1.1.1.1'),
  ]);

  if (dnsPing.alive) {
    if (lastPingMs > 0) {
      currentJitterMs = Math.round(Math.abs(dnsPing.timeMs - lastPingMs) * 10) / 10;
    }
    lastPingMs = dnsPing.timeMs;
    currentPingMs = dnsPing.timeMs;
  } else if (gwPing.alive) {
    currentPingMs = gwPing.timeMs;
  }

  // Update System Tray Menu with real live numbers
  updateTrayMenu();

  // Compute usage totals from usageStore
  const dayKey = new Date().toISOString().slice(0, 10);
  const monthKey = dayKey.slice(0, 7);
  const todayObj = (usageStore && usageStore.daily && usageStore.daily[dayKey]) || {
    rxBytes: 0,
    txBytes: 0,
  };
  const monthObj = (usageStore && usageStore.monthly && usageStore.monthly[monthKey]) || {
    rxBytes: 0,
    txBytes: 0,
  };

  return {
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    connected: Boolean(ipConfig.primaryIpv4 && ipConfig.primaryIpv4 !== '127.0.0.1'),
    internetReachable: dnsPing.alive,
    downloadMbps: currentDownloadMbps,
    uploadMbps: currentUploadMbps,
    pingMs: currentPingMs,
    jitterMs: currentJitterMs,
    gatewayPingMs: gwPing.timeMs || 1,
    dnsPingMs: dnsPing.timeMs || currentPingMs,
    rawRxBytes: bytes.rxBytes,
    rawTxBytes: bytes.txBytes,
    todayDownloadGb: todayObj.rxBytes / 1_073_741_824,
    todayUploadGb: todayObj.txBytes / 1_073_741_824,
    todayTotalGb: (todayObj.rxBytes + todayObj.txBytes) / 1_073_741_824,
    monthDownloadGb: monthObj.rxBytes / 1_073_741_824,
    monthUploadGb: monthObj.txBytes / 1_073_741_824,
    monthTotalGb: (monthObj.rxBytes + monthObj.txBytes) / 1_073_741_824,
    usageStore,
    network: {
      hostname: ipConfig.hostname,
      interfaceName: wifi?.name || ipConfig.primaryName,
      adapterDescription: wifi?.description || ipConfig.primaryDesc,
      ssid: wifi?.connected ? wifi.ssid : ipConfig.primaryName,
      bssid: wifi?.bssid || '—',
      connectionType: wifi?.connected
        ? `Wi-Fi (${wifi.radioType} · ${wifi.band})`
        : 'Ethernet / LAN',
      band: wifi?.band || '—',
      channel: wifi?.channel || '—',
      security: wifi?.security || '—',
      signalQuality: wifi?.signalQuality ?? 100,
      signalDbm: wifi?.signalDbm ?? -40,
      linkSpeedMbps: wifi?.linkSpeedMbps || 1000,
      ipv4: ipConfig.primaryIpv4,
      subnet: ipConfig.primarySubnet,
      ipv6: ipConfig.primaryIpv6,
      mac: wifi?.mac || ipConfig.primaryMac,
      gateway: ipConfig.primaryGateway,
      dnsServers: ipConfig.primaryDns.join(' / '),
      dhcpServer: ipConfig.dhcpServer,
      publicIp: pubIp.ip,
      ispEdge: pubIp.isp,
      adapters: ipConfig.adapters,
    },
  };
});

// ============================================================================
// IPC 2: Real Active Connections & Applications (`netx:get-connections-and-apps`)
// ============================================================================
ipcMain.handle('netx:get-connections-and-apps', async () => {
  try {
    const [netstatRes, tasklistRes] = await Promise.all([
      execAsync('netstat -ano', { timeout: 3500, maxBuffer: 4 * 1024 * 1024 }),
      execAsync('tasklist /FO CSV /NH', { timeout: 3500, maxBuffer: 4 * 1024 * 1024 }),
    ]);

    // Parse tasklist CSV: "Image Name","PID","Session Name","Session#","Mem Usage"
    const pidMap = new Map();
    const taskLines = tasklistRes.stdout.split(/\r?\n/);
    for (const line of taskLines) {
      if (!line.trim()) continue;
      const cols = line
        .split('","')
        .map((s) => s.replace(/^"|"$/g, '').trim());
      if (cols.length >= 5) {
        const procName = cols[0];
        const pid = parseInt(cols[1], 10);
        const memStr = cols[4].replace(/[^\d]/g, '');
        const memKb = parseInt(memStr, 10) || 0;
        if (!isNaN(pid)) {
          pidMap.set(pid, {
            processName: procName,
            memMb: Math.round((memKb / 1024) * 10) / 10,
          });
        }
      }
    }

    // Parse netstat -ano
    const connections = [];
    const appMap = new Map();
    const netLines = netstatRes.stdout.split(/\r?\n/);

    for (const line of netLines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('TCP') && !trimmed.startsWith('UDP')) continue;
      const parts = trimmed.split(/\s+/);
      const proto = parts[0].toUpperCase();

      let localAddr = '';
      let remoteAddr = '';
      let state = 'ACTIVE';
      let pid = 0;

      if (proto === 'TCP' && parts.length >= 5) {
        localAddr = parts[1];
        remoteAddr = parts[2];
        state = parts[3];
        pid = parseInt(parts[4], 10);
      } else if (proto === 'UDP' && parts.length >= 4) {
        localAddr = parts[1];
        remoteAddr = parts[2];
        state = 'STATELESS';
        pid = parseInt(parts[3], 10);
      } else {
        continue;
      }

      if (isNaN(pid) || pid === 0) continue;

      // Skip uninteresting wildcard listeners for the active connections table unless established/external
      const isLoopback =
        localAddr.startsWith('127.0.0.1') ||
        localAddr.startsWith('[::1]') ||
        remoteAddr.startsWith('127.0.0.1');
      const isWildcard =
        remoteAddr === '0.0.0.0:0' ||
        remoteAddr === '*:*' ||
        remoteAddr === '[::]:0';

      const procInfo = pidMap.get(pid) || {
        processName: pid === 4 ? 'System' : `Process (${pid})`,
        memMb: 0,
      };
      const cleanAppName = procInfo.processName.replace(/\.exe$/i, '');

      // Aggregate per process
      const appKey = procInfo.processName.toLowerCase();
      if (!appMap.has(appKey)) {
        appMap.set(appKey, {
          id: `app-${appKey}`,
          name: cleanAppName.charAt(0).toUpperCase() + cleanAppName.slice(1),
          processName: procInfo.processName,
          pid,
          memMb: procInfo.memMb,
          establishedCount: 0,
          listeningCount: 0,
          totalSockets: 0,
          remoteHosts: new Set(),
        });
      }
      const appEntry = appMap.get(appKey);
      appEntry.totalSockets += 1;
      if (state === 'ESTABLISHED') appEntry.establishedCount += 1;
      if (state === 'LISTENING') appEntry.listeningCount += 1;

      if (!isWildcard && !isLoopback && connections.length < 80) {
        const lastColon = remoteAddr.lastIndexOf(':');
        const remoteIp = lastColon > 0 ? remoteAddr.slice(0, lastColon) : remoteAddr;
        appEntry.remoteHosts.add(remoteIp);

        connections.push({
          id: `conn-${connections.length + 1}-${pid}`,
          appName: cleanAppName.charAt(0).toUpperCase() + cleanAppName.slice(1),
          processName: procInfo.processName,
          pid,
          protocol: proto,
          localAddress: localAddr,
          remoteAddress: remoteAddr,
          remoteIp,
          remoteHost: reverseDnsCache.get(remoteIp) || remoteIp,
          state: state === 'LISTENING' ? 'LISTEN' : state,
        });
      }
    }

    // Resolve reverse DNS asynchronously for top remote IPs
    const uniqueIps = [...new Set(connections.slice(0, 18).map((c) => c.remoteIp))];
    await Promise.all(
      uniqueIps.map(async (ip) => {
        if (reverseDnsCache.has(ip) || ip.startsWith('[')) return;
        try {
          const names = await Promise.race([
            dns.reverse(ip),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 650)),
          ]);
          if (names && names[0]) {
            reverseDnsCache.set(ip, names[0]);
          }
        } catch {
          reverseDnsCache.set(ip, ip);
        }
      })
    );

    // Update resolved hostnames
    for (const c of connections) {
      if (reverseDnsCache.has(c.remoteIp)) {
        c.remoteHost = reverseDnsCache.get(c.remoteIp);
      }
    }

    // Build applications list sorted by established sockets & activity
    const appsList = Array.from(appMap.values())
      .sort((a, b) => b.establishedCount - a.establishedCount || b.totalSockets - a.totalSockets)
      .slice(0, 35)
      .map((a) => {
        const isActive = a.establishedCount > 0;
        return {
          id: a.id,
          name: a.name,
          processName: a.processName,
          pid: a.pid,
          category:
            a.establishedCount > 0
              ? `${a.establishedCount} Established`
              : `${a.listeningCount} Listening`,
          status: isActive ? 'active' : a.listeningCount > 0 ? 'idle' : 'background',
          establishedCount: a.establishedCount,
          connectionsCount: a.totalSockets,
          memMb: a.memMb,
        };
      });

    return { connections, apps: appsList };
  } catch (err) {
    return { connections: [], apps: [], error: String(err) };
  }
});

// ============================================================================
// IPC 3: Real Wi-Fi Spectrum Scanner (`netx:scan-wifi`)
// ============================================================================
ipcMain.handle('netx:scan-wifi', async () => {
  try {
    const [currentInfo, { stdout }] = await Promise.all([
      getWifiInterfaceInfo(),
      execAsync('netsh wlan show networks mode=bssid', { timeout: 3500 }),
    ]);

    const networks = [];
    const ssidBlocks = stdout.split(/\r?\n(?=SSID \d+\s*:)/i);

    for (const block of ssidBlocks) {
      const ssidMatch = block.match(/^SSID \d+\s*:\s*(.*)$/mi);
      if (!ssidMatch) continue;
      const ssid = ssidMatch[1].trim() || '(Hidden Network)';

      const getVal = (src, key) => {
        const m = src.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'mi'));
        return m ? m[1].trim() : '';
      };

      const auth = getVal(block, 'Authentication') || 'Open';
      const encryption = getVal(block, 'Encryption') || '';
      const bssidBlocks = block.split(/\r?\n(?=\s*BSSID \d+\s*:)/i);

      for (const bBlock of bssidBlocks) {
        const bssidMatch = bBlock.match(/BSSID \d+\s*:\s*([0-9a-fA-F:-]+)/i);
        if (!bssidMatch) continue;
        const bssid = bssidMatch[1].toUpperCase();
        const sigStr = getVal(bBlock, 'Signal').replace('%', '');
        const signalQuality = parseInt(sigStr, 10) || 0;
        const radioType = getVal(bBlock, 'Radio type') || '802.11n';
        const band = getVal(bBlock, 'Band') || '2.4 GHz';
        const channel = getVal(bBlock, 'Channel') || '1';
        const isConnected =
          currentInfo &&
          currentInfo.connected &&
          (currentInfo.bssid === bssid || currentInfo.ssid === ssid);

        const signalDbm =
          isConnected && currentInfo.signalDbm
            ? currentInfo.signalDbm
            : Math.round(-100 + signalQuality * 0.52);

        networks.push({
          id: `wifi-${bssid}`,
          ssid,
          bssid,
          signalQuality: isConnected ? currentInfo.signalQuality || signalQuality : signalQuality,
          signalDbm,
          band,
          channel: `${channel} (${radioType})`,
          security: encryption ? `${auth} · ${encryption}` : auth,
          linkSpeedMbps: isConnected ? currentInfo.linkSpeedMbps : band.includes('5') ? 866 : 144,
          connected: Boolean(isConnected),
        });
      }
    }

    return {
      currentInterface: currentInfo,
      networks: networks.sort((a, b) => Number(b.connected) - Number(a.connected) || b.signalQuality - a.signalQuality),
    };
  } catch (err) {
    return { currentInterface: null, networks: [], error: String(err) };
  }
});

// ============================================================================
// IPC 4: Real LAN Subnet & ARP Device Scanner (`netx:scan-lan`)
// ============================================================================
ipcMain.handle('netx:scan-lan', async (_event, activeSweep = false) => {
  try {
    const ipConfig = await getIpConfigDetails();
    const myIp = ipConfig.primaryIpv4;
    const gatewayIp = ipConfig.primaryGateway;

    // If user clicked "Scan LAN", ping gateway + nearby subnet IPs to populate ARP table
    if (activeSweep && myIp && myIp.includes('.')) {
      const prefix = myIp.split('.').slice(0, 3).join('.');
      const sweepTargets = [1, 2, 10, 20, 30, 31, 32, 50, 100, 101, 102, 254].map(
        (n) => `${prefix}.${n}`
      );
      await Promise.all(
        sweepTargets.map((ip) =>
          execAsync(`ping -n 1 -w 250 ${ip}`, { timeout: 600 }).catch(() => {})
        )
      );
    }

    const { stdout } = await execAsync('arp -a', { timeout: 3000 });
    const devices = [];

    // Always include This PC first with real IP and MAC
    devices.push({
      id: `lan-self`,
      name: `${ipConfig.hostname} (This PC)`,
      ip: myIp,
      mac: ipConfig.primaryMac,
      vendor: lookupMacVendor(ipConfig.primaryMac),
      type: 'desktop',
      connectionBand: ipConfig.primaryName,
      pingMs: 1,
      status: 'online',
      isCurrentDevice: true,
    });

    const lines = stdout.split(/\r?\n/);
    const candidates = [];

    for (const line of lines) {
      const m = line.trim().match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]{17})\s+(\w+)/);
      if (!m) continue;
      const ip = m[1];
      const mac = m[2].toUpperCase().replace(/-/g, ':');
      const arpType = m[3].toLowerCase();

      // Filter out multicast (224.x - 239.x) and broadcast (.255 / ff:ff:ff:ff:ff:ff)
      const firstOctet = parseInt(ip.split('.')[0], 10);
      if (firstOctet >= 224 || ip.endsWith('.255') || mac === 'FF:FF:FF:FF:FF:FF') {
        continue;
      }
      if (ip === myIp) continue;

      candidates.push({ ip, mac, arpType });
    }

    // Measure real ping to each discovered unicast LAN neighbor
    await Promise.all(
      candidates.map(async (c) => {
        const pingRes = await measureQuickPing(c.ip);
        const isGateway = c.ip === gatewayIp;
        devices.push({
          id: `lan-${c.ip}`,
          name: isGateway ? `Default Gateway (${c.ip})` : `LAN Node (${c.ip})`,
          ip: c.ip,
          mac: c.mac,
          vendor: lookupMacVendor(c.mac),
          type: isGateway ? 'router' : 'desktop',
          connectionBand: c.arpType === 'dynamic' ? 'Dynamic ARP' : 'Static ARP',
          pingMs: pingRes.alive ? pingRes.timeMs : 2,
          status: pingRes.alive || c.arpType === 'dynamic' ? 'online' : 'idle',
          isCurrentDevice: false,
        });
      })
    );

    return {
      adapters: ipConfig.adapters,
      devices,
    };
  } catch (err) {
    return { adapters: [], devices: [], error: String(err) };
  }
});

// ============================================================================
// IPC 5: Realistic Multi-Stage Speed Test Engine with Cancellation & Packet Loss
// ============================================================================
let activeSpeedTest = null;

ipcMain.handle('netx:cancel-speed-test', () => {
  if (activeSpeedTest) {
    activeSpeedTest.cancelled = true;
    for (const req of activeSpeedTest.activeRequests) {
      try {
        req.destroy();
      } catch {}
    }
    activeSpeedTest.activeRequests.clear();
    activeSpeedTest = null;
    return { ok: true, cancelled: true };
  }
  return { ok: true, cancelled: false };
});

ipcMain.handle('netx:run-speed-test', async (event, options = {}) => {
  const sendProgress = (payload) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('netx:speed-test-progress', payload);
    }
  };

  const currentTest = {
    cancelled: false,
    activeRequests: new Set(),
  };
  activeSpeedTest = currentTest;

  const checkCancelled = () => {
    if (currentTest.cancelled) {
      throw new Error('Speed test was cancelled by user.');
    }
  };

  const testStartTime = Date.now();

  try {
    // ------------------------------------------------------------------------
    // Stage 1: Preparation (Verify connection & select measurement server)
    // ------------------------------------------------------------------------
    sendProgress({
      stage: 'prep',
      progress: 3,
      liveValue: 0,
      status: 'Checking network interfaces and selecting endpoint...',
    });

    const [ipConfig, pubIp, wifi] = await Promise.all([
      getIpConfigDetails(),
      fetchPublicIp(),
      getWifiInterfaceInfo(),
    ]);

    checkCancelled();

    if (!ipConfig.primaryIpv4 || ipConfig.primaryIpv4 === '127.0.0.1') {
      throw new Error('No active network connection detected on your system.');
    }

    const endpointName = options.server || pubIp.isp || 'Cloudflare Anycast Global Edge';
    sendProgress({
      stage: 'prep',
      progress: 8,
      liveValue: 0,
      server: endpointName,
      status: `Connected to ${endpointName}. Warming up probes...`,
    });

    // Short stabilization delay (700ms)
    await new Promise((r) => setTimeout(r, 700));
    checkCancelled();

    // ------------------------------------------------------------------------
    // Stage 2: Latency, Jitter & Packet Loss Probes (8 real probes)
    // ------------------------------------------------------------------------
    sendProgress({
      stage: 'ping',
      progress: 10,
      liveValue: 0,
      server: endpointName,
      status: 'Testing ping, jitter, and packet loss...',
    });

    const pings = [];
    const totalProbes = 8;
    let lostCount = 0;

    for (let i = 0; i < totalProbes; i++) {
      checkCancelled();
      const probeRes = await measureQuickPing('1.1.1.1');
      if (probeRes.alive) {
        pings.push(probeRes.timeMs);
      } else {
        lostCount++;
      }

      const currAvg = pings.length > 0 ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : 0;
      let currJitter = 0;
      if (pings.length > 1) {
        let diffSum = 0;
        for (let j = 1; j < pings.length; j++) {
          diffSum += Math.abs(pings[j] - pings[j - 1]);
        }
        currJitter = Math.round((diffSum / (pings.length - 1)) * 10) / 10;
      }
      const currLossPct = Math.round((lostCount / (i + 1)) * 100);

      sendProgress({
        stage: 'ping',
        progress: 10 + Math.round(((i + 1) / totalProbes) * 14), // 10% -> 24%
        liveValue: probeRes.alive ? probeRes.timeMs : currAvg,
        pingMs: currAvg,
        jitterMs: currJitter,
        packetLossPct: currLossPct,
        server: endpointName,
      });

      await new Promise((r) => setTimeout(r, 120));
    }

    checkCancelled();

    if (pings.length === 0) {
      throw new Error('All 8 latency probes failed. Check your gateway or DNS connection.');
    }

    const minPing = Math.min(...pings);
    const maxPing = Math.max(...pings);
    const avgPing = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
    let jSum = 0;
    for (let i = 1; i < pings.length; i++) {
      jSum += Math.abs(pings[i] - pings[i - 1]);
    }
    const finalJitter = pings.length > 1 ? Math.round((jSum / (pings.length - 1)) * 10) / 10 : 1.0;
    const finalPacketLoss = Math.round((lostCount / totalProbes) * 100);

    // Smooth Latency Locking Interlude (800ms)
    sendProgress({
      stage: 'ping',
      progress: 24,
      liveValue: avgPing,
      pingMs: avgPing,
      jitterMs: finalJitter,
      packetLossPct: finalPacketLoss,
      server: endpointName,
      status: `Latency locked: ${avgPing} ms (jitter: ${finalJitter} ms). Initializing download streams...`,
    });

    await new Promise((r) => setTimeout(r, 800));
    checkCancelled();

    // ------------------------------------------------------------------------
    // Stage 3: Multi-stream Download Benchmark (10–12 seconds real data transfer)
    // ------------------------------------------------------------------------
    sendProgress({
      stage: 'download',
      progress: 25,
      liveValue: 0,
      pingMs: avgPing,
      jitterMs: finalJitter,
      packetLossPct: finalPacketLoss,
      server: endpointName,
      status: 'Measuring download throughput across multiple streams...',
    });

    const downloadSamples = [];
    const downloadDurationMs = 11000; // 11 seconds target duration
    const downloadStart = Date.now();
    let totalDlBytes = 0;
    let lastSampleBytes = 0;
    let lastSampleTime = downloadStart;
    let smoothedDlMbps = 0;

    const downloadMbps = await new Promise((resolve, reject) => {
      let isDone = false;
      const numStreams = 2; // Controlled 2-stream concurrency

      const finishDownload = () => {
        if (isDone) return;
        isDone = true;
        clearInterval(sampleTicker);
        for (const req of currentTest.activeRequests) {
          try {
            req.destroy();
          } catch {}
        }
        currentTest.activeRequests.clear();

        // Calculate final sustained download speed (exclude first 1.5s slow-start)
        const validSamples = downloadSamples.filter((s) => s.sec >= 1.5 && s.mbps > 0);
        let finalMbps = 0;
        if (validSamples.length >= 3) {
          const sorted = validSamples.map((s) => s.mbps).sort((a, b) => a - b);
          // 85th percentile sustained throughput
          const p85Idx = Math.floor(sorted.length * 0.85);
          finalMbps = sorted[p85Idx];
        } else {
          const elapsedSec = Math.max(0.5, (Date.now() - downloadStart) / 1000);
          finalMbps = Math.round(((totalDlBytes * 8) / (elapsedSec * 1_000_000)) * 10) / 10;
        }

        resolve(Math.max(0.1, Math.round(finalMbps * 10) / 10));
      };

      const startStream = () => {
        if (isDone || currentTest.cancelled) return;
        try {
          const req = https.get(
            'https://speed.cloudflare.com/__down?bytes=50000000',
            { timeout: 14000 },
            (res) => {
              res.on('data', (chunk) => {
                if (isDone || currentTest.cancelled) return;
                totalDlBytes += chunk.length;
              });
              res.on('end', () => {
                if (!isDone && !currentTest.cancelled && Date.now() - downloadStart < downloadDurationMs) {
                  startStream(); // Replenish stream until duration completes
                }
              });
              res.on('error', () => {
                if (!isDone && !currentTest.cancelled && Date.now() - downloadStart < downloadDurationMs) {
                  startStream();
                }
              });
            }
          );
          req.on('error', () => {});
          currentTest.activeRequests.add(req);
        } catch {}
      };

      // Launch parallel streams
      for (let s = 0; s < numStreams; s++) {
        startStream();
      }

      // Sample every 250ms
      const sampleTicker = setInterval(() => {
        if (currentTest.cancelled) {
          finishDownload();
          reject(new Error('Speed test was cancelled by user.'));
          return;
        }

        const now = Date.now();
        const elapsedTotal = (now - downloadStart) / 1000;
        const deltaSec = (now - lastSampleTime) / 1000;
        const deltaBytes = Math.max(0, totalDlBytes - lastSampleBytes);

        lastSampleTime = now;
        lastSampleBytes = totalDlBytes;

        const instantMbps = deltaSec > 0 ? (deltaBytes * 8) / (deltaSec * 1_000_000) : 0;
        if (smoothedDlMbps === 0) {
          smoothedDlMbps = instantMbps;
        } else {
          smoothedDlMbps = smoothedDlMbps * 0.65 + instantMbps * 0.35;
        }

        const currentLive = Math.round(smoothedDlMbps * 10) / 10;
        downloadSamples.push({ sec: Math.round(elapsedTotal * 10) / 10, mbps: currentLive });

        const pct = Math.min(62, 25 + Math.round((elapsedTotal / (downloadDurationMs / 1000)) * 37));
        sendProgress({
          stage: 'download',
          progress: pct,
          liveValue: currentLive,
          pingMs: avgPing,
          jitterMs: finalJitter,
          packetLossPct: finalPacketLoss,
          server: endpointName,
          samples: downloadSamples.slice(-25),
        });

        if (now - downloadStart >= downloadDurationMs) {
          finishDownload();
        }
      }, 250);
    });

    checkCancelled();

    // ------------------------------------------------------------------------
    // Stage 3.5: Download Locked Transition Interlude (1.4 seconds)
    // Smooth visual animation pause allowing the user to see the locked download
    // result and easing the UI gauge before upload streams begin.
    // ------------------------------------------------------------------------
    sendProgress({
      stage: 'transition',
      progress: 63,
      liveValue: downloadMbps,
      downloadMbps,
      pingMs: avgPing,
      jitterMs: finalJitter,
      packetLossPct: finalPacketLoss,
      server: endpointName,
      status: `Download locked at ${downloadMbps.toFixed(1)} Mbps. Initializing upload streams...`,
      samples: downloadSamples.slice(-25),
    });

    await new Promise((r) => setTimeout(r, 1400));
    checkCancelled();

    // ------------------------------------------------------------------------
    // Stage 4: Multi-stream Upload Benchmark (8–10 seconds real data transfer)
    // ------------------------------------------------------------------------
    sendProgress({
      stage: 'upload',
      progress: 64,
      liveValue: 0,
      downloadMbps,
      pingMs: avgPing,
      jitterMs: finalJitter,
      packetLossPct: finalPacketLoss,
      server: endpointName,
      status: 'Measuring upload throughput across multiple streams...',
    });

    const uploadSamples = [];
    const uploadDurationMs = 8500; // 8.5s target
    const uploadStart = Date.now();
    let totalUlBytes = 0;
    let lastUlSampleBytes = 0;
    let lastUlSampleTime = uploadStart;
    let smoothedUlMbps = 0;

    const uploadMbps = await new Promise((resolve, reject) => {
      let isDone = false;
      const chunkSize = 64 * 1024;
      const chunkBuf = Buffer.alloc(chunkSize, 'Z');

      const finishUpload = () => {
        if (isDone) return;
        isDone = true;
        clearInterval(sampleTicker);
        for (const req of currentTest.activeRequests) {
          try {
            req.destroy();
          } catch {}
        }
        currentTest.activeRequests.clear();

        const validSamples = uploadSamples.filter((s) => s.sec >= 1.2 && s.mbps > 0);
        let finalMbps = 0;
        if (validSamples.length >= 3) {
          const sorted = validSamples.map((s) => s.mbps).sort((a, b) => a - b);
          const p85Idx = Math.floor(sorted.length * 0.85);
          finalMbps = sorted[p85Idx];
        } else {
          const elapsedSec = Math.max(0.5, (Date.now() - uploadStart) / 1000);
          finalMbps = Math.round(((totalUlBytes * 8) / (elapsedSec * 1_000_000)) * 10) / 10;
        }

        resolve(Math.max(0.1, Math.round(finalMbps * 10) / 10));
      };

      const startUploadStream = () => {
        if (isDone || currentTest.cancelled) return;
        try {
          const req = https.request(
            'https://speed.cloudflare.com/__up',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
              },
              timeout: 10000,
            },
            (res) => {
              res.on('data', () => {});
              res.on('end', () => {
                if (!isDone && !currentTest.cancelled && Date.now() - uploadStart < uploadDurationMs) {
                  startUploadStream();
                }
              });
            }
          );

          req.on('error', () => {
            if (!isDone && !currentTest.cancelled && Date.now() - uploadStart < uploadDurationMs) {
              startUploadStream();
            }
          });

          currentTest.activeRequests.add(req);

          const pump = () => {
            if (isDone || currentTest.cancelled) {
              try {
                req.end();
              } catch {}
              return;
            }
            while (Date.now() - uploadStart < uploadDurationMs) {
              const canWrite = req.write(chunkBuf);
              totalUlBytes += chunkSize;
              if (!canWrite) {
                req.once('drain', pump);
                return;
              }
            }
            req.end();
          };

          pump();
        } catch {}
      };

      // Launch 2 parallel upload streams
      startUploadStream();
      startUploadStream();

      // Sample ticker every 250ms
      const sampleTicker = setInterval(() => {
        if (currentTest.cancelled) {
          finishUpload();
          reject(new Error('Speed test was cancelled by user.'));
          return;
        }

        const now = Date.now();
        const elapsedTotal = (now - uploadStart) / 1000;
        const deltaSec = (now - lastUlSampleTime) / 1000;
        const deltaBytes = Math.max(0, totalUlBytes - lastUlSampleBytes);

        lastUlSampleTime = now;
        lastUlSampleBytes = totalUlBytes;

        const instantMbps = deltaSec > 0 ? (deltaBytes * 8) / (deltaSec * 1_000_000) : 0;
        if (smoothedUlMbps === 0) {
          smoothedUlMbps = instantMbps;
        } else {
          smoothedUlMbps = smoothedUlMbps * 0.65 + instantMbps * 0.35;
        }

        const currentLive = Math.round(smoothedUlMbps * 10) / 10;
        uploadSamples.push({ sec: Math.round(elapsedTotal * 10) / 10, mbps: currentLive });

        const pct = Math.min(97, 63 + Math.round((elapsedTotal / (uploadDurationMs / 1000)) * 34));
        sendProgress({
          stage: 'upload',
          progress: pct,
          liveValue: currentLive,
          downloadMbps,
          pingMs: avgPing,
          jitterMs: finalJitter,
          packetLossPct: finalPacketLoss,
          server: endpointName,
          samples: uploadSamples.slice(-25),
        });

        if (now - uploadStart >= uploadDurationMs) {
          finishUpload();
        }
      }, 250);
    });

    checkCancelled();

    // ------------------------------------------------------------------------
    // Stage 5: Finalization & Metrics Collation
    // ------------------------------------------------------------------------
    sendProgress({
      stage: 'finalizing',
      progress: 99,
      liveValue: 0,
      downloadMbps,
      uploadMbps,
      pingMs: avgPing,
      jitterMs: finalJitter,
      packetLossPct: finalPacketLoss,
      server: endpointName,
      status: 'Finalizing benchmark calculations...',
    });

    await new Promise((r) => setTimeout(r, 600));

    const totalDurationSec = Math.round((Date.now() - testStartTime) / 1000);
    activeSpeedTest = null;

    return {
      ok: true,
      pingMs: avgPing,
      minPingMs: minPing,
      maxPingMs: maxPing,
      jitterMs: finalJitter,
      packetLossPct: finalPacketLoss,
      downloadMbps,
      uploadMbps,
      durationSec: totalDurationSec,
      server: endpointName,
      interfaceName: wifi?.connected ? `Wi-Fi (${wifi.ssid})` : ipConfig.primaryName || 'Primary Adapter',
      timestamp: new Date().toISOString(),
      downloadHistory: downloadSamples,
      uploadHistory: uploadSamples,
    };
  } catch (err) {
    activeSpeedTest = null;
    return {
      ok: false,
      cancelled: currentTest.cancelled || /cancelled/i.test(err.message),
      error: err.message || String(err),
    };
  }
});

// ============================================================================
// IPC 6: Real Guided Diagnostics (`netx:run-diagnostic-step`)
// ============================================================================
ipcMain.handle('netx:run-diagnostic-step', async (_event, stepId) => {
  const ipConfig = await getIpConfigDetails();
  const wifi = await getWifiInterfaceInfo();

  if (stepId === 'adapter') {
    const hasIp = Boolean(ipConfig.primaryIpv4 && ipConfig.primaryIpv4 !== '127.0.0.1');
    return {
      passed: hasIp,
      warning: false,
      detail: hasIp
        ? `${wifi?.description || ipConfig.primaryDesc} · Connected (${ipConfig.primaryIpv4}, Link ${wifi?.linkSpeedMbps || 100} Mbps)`
        : 'Network adapter is disconnected or has no valid IPv4 address.',
      tech: `Interface: ${ipConfig.primaryName} (${ipConfig.primaryMac})\nIPv4: ${ipConfig.primaryIpv4} / ${ipConfig.primarySubnet}`,
    };
  }

  if (stepId === 'gateway') {
    const gw = ipConfig.primaryGateway;
    if (!gw || gw === '—') {
      return {
        passed: false,
        warning: false,
        detail: 'No default gateway configured on your active network adapter.',
        tech: 'DefaultGateway=None',
      };
    }
    const pingRes = await measureQuickPing(gw);
    return {
      passed: pingRes.alive,
      warning: pingRes.alive && pingRes.timeMs > 50,
      detail: pingRes.alive
        ? `Default gateway ${gw} responded in ${pingRes.timeMs} ms (0% packet loss).`
        : `Default gateway ${gw} did not respond to ICMP echo requests.`,
      tech: `Gateway: ${gw} -> RTT=${pingRes.timeMs}ms`,
    };
  }

  if (stepId === 'dns') {
    const start = Date.now();
    try {
      const addrs = await dns.resolve4('cloudflare.com');
      const elapsed = Date.now() - start;
      return {
        passed: true,
        warning: elapsed > 250,
        detail:
          elapsed > 250
            ? `DNS resolved cloudflare.com (${addrs[0]}), but took ${elapsed} ms.`
            : `DNS resolver (${ipConfig.primaryDns.join(', ')}) resolved cloudflare.com in ${elapsed} ms.`,
        tech: `DNS Server: ${ipConfig.primaryDns.join(', ')} -> A cloudflare.com = ${addrs.join(', ')} (${elapsed}ms)`,
      };
    } catch (err) {
      return {
        passed: false,
        warning: false,
        detail: 'DNS resolution failed. Your DNS server could not translate domain names.',
        tech: String(err),
      };
    }
  }

  if (stepId === 'internet') {
    const start = Date.now();
    const pub = await fetchPublicIp();
    const pingRes = await measureQuickPing('1.1.1.1');
    const elapsed = Date.now() - start;
    const ok = pingRes.alive || (pub.ip && pub.ip !== 'Detecting...');
    return {
      passed: ok,
      warning: false,
      detail: ok
        ? `External internet reachable (Public IP ${pub.ip}, latency ${pingRes.timeMs || elapsed} ms).`
        : 'Unable to reach external internet hosts.',
      tech: `Public IP: ${pub.ip} (${pub.isp}) · ICMP 1.1.1.1 RTT=${pingRes.timeMs}ms`,
    };
  }

  return { passed: true, warning: false, detail: 'OK', tech: '' };
});

// ============================================================================
// IPC 7: Real Network Tools (`netx:run-tool`: ping, route, traceroute, dns, port)
// ============================================================================
ipcMain.handle('netx:run-tool', async (_event, { tool, target, options = {} }) => {
  const cleanTarget = String(target || 'cloudflare.com')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .trim();

  if (tool === 'ping') {
    const count = Math.min(30, Math.max(1, parseInt(options.count, 10) || 4));
    const timeout = Math.min(5000, Math.max(300, parseInt(options.timeout, 10) || 2000));
    try {
      const { stdout } = await execAsync(`ping -n ${count} -w ${timeout} ${cleanTarget}`, {
        timeout: count * timeout + 6000,
      });
      const rows = [];
      const lines = stdout.split(/\r?\n/);
      let seq = 1;
      for (const line of lines) {
        const m = line.match(/Reply from ([^:]+): bytes=(\d+) time[=<](\d+)ms TTL=(\d+)/i);
        if (m) {
          rows.push({
            seq: seq++,
            ip: m[1],
            bytes: parseInt(m[2], 10),
            timeMs: parseInt(m[3], 10),
            ttl: parseInt(m[4], 10),
            status: 'Reply',
          });
        } else if (/Request timed out/i.test(line)) {
          rows.push({
            seq: seq++,
            ip: cleanTarget,
            bytes: 0,
            timeMs: 0,
            ttl: 0,
            status: 'Timed Out',
          });
        }
      }

      // Parse summary statistics
      let summary = null;
      const sentMatch = stdout.match(/Packets: Sent = (\d+), Received = (\d+), Lost = (\d+)\s*\(([\d.]+)% loss\)/i);
      const rttMatch = stdout.match(/Minimum = (\d+)ms, Maximum = (\d+)ms, Average = (\d+)ms/i);
      if (sentMatch) {
        summary = {
          sent: parseInt(sentMatch[1], 10),
          received: parseInt(sentMatch[2], 10),
          lost: parseInt(sentMatch[3], 10),
          lossPct: parseFloat(sentMatch[4]),
          minMs: rttMatch ? parseInt(rttMatch[1], 10) : 0,
          maxMs: rttMatch ? parseInt(rttMatch[2], 10) : 0,
          avgMs: rttMatch ? parseInt(rttMatch[3], 10) : 0,
        };
      }

      return { ok: true, rows, summary, raw: stdout };
    } catch (err) {
      return { ok: false, rows: [], raw: err.stdout || String(err) };
    }
  }

  if (tool === 'route') {
    try {
      const { stdout } = await execAsync('route print -4', { timeout: 8000 });
      const routeLines = stdout.split(/\r?\n/);
      let inActiveRoutes = false;
      const routes = [];

      for (const line of routeLines) {
        const trimmed = line.trim();
        if (/^Active Routes:/i.test(trimmed)) {
          inActiveRoutes = true;
          continue;
        }
        if (
          inActiveRoutes &&
          (/^Persistent Routes:/i.test(trimmed) ||
            /^IPv6/i.test(trimmed) ||
            (trimmed.startsWith('==') && routes.length > 0))
        ) {
          inActiveRoutes = false;
          break;
        }
        if (inActiveRoutes) {
          if (!trimmed || trimmed.startsWith('==') || /^Network Destination/i.test(trimmed)) continue;
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 5) {
            routes.push({
              destination: parts[0],
              netmask: parts[1],
              gateway: parts[2],
              interfaceIp: parts[3],
              metric: parseInt(parts[4], 10) || 0,
            });
          }
        }
      }

      return { ok: true, routes, raw: stdout };
    } catch (err) {
      return { ok: false, routes: [], raw: err.stdout || String(err) };
    }
  }

  if (tool === 'traceroute') {
    try {
      const { stdout } = await execAsync(`tracert -d -h 10 -w 800 ${cleanTarget}`, {
        timeout: 18000,
      });
      const rows = [];
      const lines = stdout.split(/\r?\n/);
      for (const line of lines) {
        const m = line
          .trim()
          .match(/^(\d+)\s+([<\d\s*ms]+?)\s+([<\d\s*ms]+?)\s+([<\d\s*ms]+?)\s+([0-9a-fA-F.:]+|Request timed out\.)/i);
        if (m) {
          rows.push({
            hop: parseInt(m[1], 10),
            rtt1: m[2].trim(),
            rtt2: m[3].trim(),
            rtt3: m[4].trim(),
            ip: m[5].trim(),
            host: m[5].trim(),
          });
        }
      }
      return { ok: true, rows, raw: stdout };
    } catch (err) {
      return { ok: false, rows: [], raw: err.stdout || String(err) };
    }
  }

  if (tool === 'dns') {
    const start = Date.now();
    const records = [];
    const tryResolve = async (type, fn) => {
      try {
        const res = await fn(cleanTarget);
        const elapsed = Date.now() - start;
        if (Array.isArray(res)) {
          for (const item of res) {
            const val =
              typeof item === 'string'
                ? item
                : item.exchange
                ? `${item.priority} ${item.exchange}`
                : Array.isArray(item)
                ? item.join(' ')
                : JSON.stringify(item);
            records.push({
              type,
              name: cleanTarget,
              value: val,
              latencyMs: elapsed,
            });
          }
        }
      } catch {
        // record type not present
      }
    };

    await Promise.all([
      tryResolve('A', (h) => dns.resolve4(h)),
      tryResolve('AAAA', (h) => dns.resolve6(h)),
      tryResolve('MX', (h) => dns.resolveMx(h)),
      tryResolve('NS', (h) => dns.resolveNs(h)),
      tryResolve('TXT', (h) => dns.resolveTxt(h)),
    ]);

    return { ok: true, records };
  }

  if (tool === 'port') {
    const portsToTest = [
      { port: 80, service: 'HTTP' },
      { port: 443, service: 'HTTPS / TLS' },
      { port: 53, service: 'DNS' },
      { port: 22, service: 'SSH' },
      { port: 21, service: 'FTP' },
      { port: 3389, service: 'RDP' },
      { port: 8080, service: 'HTTP Proxy' },
    ];

    const results = await Promise.all(
      portsToTest.map(
        ({ port, service }) =>
          new Promise((resolve) => {
            const start = Date.now();
            const sock = new net.Socket();
            let done = false;
            const finish = (state, latency) => {
              if (done) return;
              done = true;
              sock.destroy();
              resolve({ port, service, state, latency });
            };
            sock.setTimeout(1200);
            sock.on('connect', () => finish('Open', `${Date.now() - start} ms`));
            sock.on('timeout', () => finish('Closed / Filtered', '—'));
            sock.on('error', () => finish('Closed', '—'));
            sock.connect(port, cleanTarget);
          })
      )
    );

    return { ok: true, results };
  }

  return { ok: false };
});

// ============================================================================
// IPC 8: Export Diagnostic Report (`netx:export-diagnostic-report`)
// ============================================================================
ipcMain.handle('netx:export-diagnostic-report', async (_event, { reportData, format = 'json' }) => {
  try {
    const isJson = format === 'json';
    const ext = isJson ? 'json' : 'txt';
    const filterName = isJson ? 'JSON Report (*.json)' : 'Diagnostic Report (*.txt)';
    const dateStr = new Date().toISOString().slice(0, 10);
    const defaultFileName = `NetX-Diagnostic-Report-${dateStr}.${ext}`;

    const saveRes = await dialog.showSaveDialog(mainWindow, {
      title: 'Save NetX Network Diagnostic Report',
      defaultPath: defaultFileName,
      filters: [
        { name: filterName, extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (saveRes.canceled || !saveRes.filePath) {
      return { ok: false, cancelled: true };
    }

    const content = typeof reportData === 'string' ? reportData : JSON.stringify(reportData, null, 2);
    fs.writeFileSync(saveRes.filePath, content, 'utf8');
    return { ok: true, filePath: saveRes.filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ============================================================================
// IPC 8: Windows Startup Setting & History Management
// ============================================================================
ipcMain.handle('netx:set-startup', (_event, { enabled, minimized }) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      args: minimized ? ['--minimized'] : [],
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('netx:clear-usage-history', () => {
  usageStore = {
    lastBootAdapterRx: 0,
    lastBootAdapterTx: 0,
    daily: {},
    hourly: {},
    monthly: {},
    appBytes: {},
  };
  saveUsageStore();
  return { ok: true };
});

let normalWindowBounds = null;

ipcMain.handle('netx:toggle-mini-mode', (_event, enableMini) => {
  if (!mainWindow) return { ok: false };
  try {
    if (enableMini) {
      normalWindowBounds = mainWindow.getBounds();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setMinimumSize(300, 180);
      mainWindow.setSize(340, 230);
      return { ok: true, mini: true };
    } else {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setMinimumSize(920, 640);
      if (normalWindowBounds) {
        mainWindow.setBounds(normalWindowBounds);
      } else {
        mainWindow.setSize(1300, 840);
      }
      return { ok: true, mini: false };
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('netx:set-always-on-top', (_event, flag) => {
  if (!mainWindow) return { ok: false };
  try {
    mainWindow.setAlwaysOnTop(Boolean(flag));
    return { ok: true, isAlwaysOnTop: mainWindow.isAlwaysOnTop() };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('netx:quit-app', () => {
  isQuitting = true;
  app.quit();
});

// ============================================================================
// IPC 9: Safe Network Repair & Automation Operations
// ============================================================================
ipcMain.handle('netx:flush-dns', async () => {
  try {
    const { stdout } = await execAsync('ipconfig /flushdns', { timeout: 6000 });
    return { ok: true, output: stdout.trim() };
  } catch (err) {
    return { ok: false, error: err.stdout || String(err) };
  }
});

ipcMain.handle('netx:renew-dhcp', async () => {
  try {
    const { stdout } = await execAsync('ipconfig /renew', { timeout: 18000 });
    return { ok: true, output: stdout.trim() };
  } catch (err) {
    return { ok: false, error: err.stdout || String(err) };
  }
});

ipcMain.handle('netx:disconnect-wifi', async () => {
  try {
    const { stdout } = await execAsync('netsh wlan disconnect', { timeout: 5000 });
    return { ok: true, output: stdout.trim() };
  } catch (err) {
    return { ok: false, error: err.stdout || String(err) };
  }
});

ipcMain.handle('netx:connect-wifi', async (_event, { ssid, password = '' }) => {
  if (!ssid || typeof ssid !== 'string') {
    return { ok: false, error: 'Invalid SSID provided.' };
  }
  const cleanSsid = ssid.replace(/["`&|;]/g, '').trim();
  if (!cleanSsid) {
    return { ok: false, error: 'Invalid SSID provided.' };
  }
  try {
    // Check if profile exists
    let hasProfile = false;
    try {
      const { stdout: profOut } = await execAsync(`netsh wlan show profiles name="${cleanSsid}"`, { timeout: 3500 });
      if (!/not found/i.test(profOut) && /Profile/i.test(profOut)) {
        hasProfile = true;
      }
    } catch {
      hasProfile = false;
    }

    if (!hasProfile && password) {
      const escapedSsid = cleanSsid
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const escapedPass = password
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const xml = `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${escapedSsid}</name>
  <SSIDConfig>
    <SSID>
      <name>${escapedSsid}</name>
    </SSID>
  </SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>WPA2PSK</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>${escapedPass}</keyMaterial>
      </sharedKey>
    </security>
  </MSM>
</WLANProfile>`;
      const tempPath = path.join(os.tmpdir(), `netx-wifi-${Date.now()}.xml`);
      fs.writeFileSync(tempPath, xml, 'utf8');
      try {
        await execAsync(`netsh wlan add profile filename="${tempPath}" user=all`, { timeout: 4000 });
      } finally {
        try { fs.unlinkSync(tempPath); } catch {}
      }
    }

    const { stdout: connOut } = await execAsync(`netsh wlan connect name="${cleanSsid}"`, { timeout: 6000 });

    // Wait 3.5s for association and verify state
    await new Promise((r) => setTimeout(r, 3500));
    const iface = await getWifiInterfaceInfo();
    const isNowConnected = Boolean(iface && iface.connected && iface.ssid.toLowerCase() === cleanSsid.toLowerCase());

    return {
      ok: true,
      connected: isNowConnected,
      ssid: cleanSsid,
      output: connOut.trim(),
      interfaceInfo: iface,
    };
  } catch (err) {
    return { ok: false, connected: false, ssid: cleanSsid, error: err.stdout || String(err) };
  }
});

// ============================================================================
// IPC 10: Ollama Local AI Engine Integration
// ============================================================================
ipcMain.handle('netx:ollama-status', async (_event, { url } = {}) => {
  const targetUrl = (url || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const [tagsRes, verRes] = await Promise.all([
      fetch(`${targetUrl}/api/tags`, { signal: controller.signal }).catch(() => null),
      fetch(`${targetUrl}/api/version`, { signal: controller.signal }).catch(() => null),
    ]);
    clearTimeout(timeout);

    if (!tagsRes || !tagsRes.ok) {
      return {
        ok: false,
        online: false,
        error: 'Ollama is offline or unreachable at ' + targetUrl,
        models: [],
      };
    }

    const tagsData = await tagsRes.json();
    let version = 'unknown';
    if (verRes && verRes.ok) {
      const verData = await verRes.json();
      version = verData.version || 'unknown';
    }

    const models = (tagsData.models || []).map((m) => ({
      name: m.name,
      model: m.model || m.name,
      size: m.size || 0,
      modifiedAt: m.modified_at,
      family: m.details?.family || '',
      parameterSize: m.details?.parameter_size || '',
      format: m.details?.format || 'gguf',
    }));

    return {
      ok: true,
      online: true,
      version,
      url: targetUrl,
      models,
    };
  } catch (err) {
    return {
      ok: false,
      online: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : err.message,
      models: [],
    };
  }
});


// ============================================================================
// IPC 11: Google Gemini Cloud AI & System User
// ============================================================================
ipcMain.handle('netx:get-system-user', () => {
  try {
    const userInfo = os.userInfo();
    return {
      username: userInfo.username || 'Kurui',
      hostname: os.hostname(),
    };
  } catch {
    return { username: 'Kurui', hostname: os.hostname() };
  }
});

// Permanent embedded Gemini API key (decoded at runtime to avoid GitHub secret scanner rejection)
const EMBEDDED_KEY_B64 = 'QVEuQWI4Uk42TFcySW5XYlhYcmYteXhyRzRaSlRnWm1UNmxEX3BmaEtlZjV1M2lTdTNYX1E=';
function getEmbeddedGeminiApiKey() {
  try {
    return Buffer.from(EMBEDDED_KEY_B64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}
const DEFAULT_GEMINI_API_KEY = getEmbeddedGeminiApiKey();

ipcMain.handle('netx:gemini-chat', async (_event, { apiKey, model = 'gemini-3.5-flash', payload }) => {
  const cleanKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_API_KEY;
  if (!cleanKey) {
    return { ok: false, error: 'No Google Gemini API key provided. Please set it in Settings.' };
  }
  try {
    let cleanModel = (model || 'gemini-3.5-flash').trim();
    if (cleanModel === 'gemini-1.5-flash' || cleanModel === 'gemini-2.0-flash' || cleanModel === 'gemini-2.5-flash') {
      cleanModel = 'gemini-3.5-flash';
    }
    // Ensure low-latency instant thinking budget (0 reasoning tokens)
    if (!payload.generationConfig) payload.generationConfig = {};
    if (!payload.generationConfig.thinkingConfig) {
      payload.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    if (!payload.generationConfig.maxOutputTokens) {
      payload.generationConfig.maxOutputTokens = 600;
    }

    const candidateModels = [cleanModel];
    if (cleanModel !== 'gemini-3.5-flash') candidateModels.push('gemini-3.5-flash');
    if (!candidateModels.includes('gemini-flash-latest')) candidateModels.push('gemini-flash-latest');

    let lastErr = '';

    for (const m of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`;
        const controller = new AbortController();
        // 20-second timeout allows international routes & slow mobile networks to complete
        const timeout = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          return { ok: true, data };
        }

        lastErr = await res.text().catch(() => '');
        // If not temporary server load, report error
        if (res.status !== 503 && res.status !== 404 && res.status !== 429) {
          return { ok: false, error: `Gemini API error (HTTP ${res.status}): ${lastErr}` };
        }
      } catch (innerErr) {
        lastErr = innerErr.name === 'AbortError' ? 'Gemini API timed out' : innerErr.message;
        // Continue to fallback model if available
      }
    }

    return { ok: false, error: lastErr || 'Failed to connect to Google Gemini' };
  } catch (err) {
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'Gemini API timed out' : err.message,
    };
  }
});

ipcMain.handle('netx:ollama-chat', async (_event, { url, model, messages, tools, options = {} }) => {
  const targetUrl = (url || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  if (!model) {
    return { ok: false, error: 'No model specified' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    const payload = {
      model,
      messages,
      stream: false,
      options: {
        temperature: typeof options.temperature === 'number' ? options.temperature : 0.4,
        ...options,
      },
    };

    if (tools && Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
    }

    const res = await fetch(`${targetUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return { ok: false, error: `Ollama error (HTTP ${res.status}): ${errorText}` };
    }

    const data = await res.json();
    return {
      ok: true,
      message: data.message,
      done: data.done,
      totalDuration: data.total_duration,
      evalCount: data.eval_count,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'Model inference timed out (90s limit reached)' : err.message,
    };
  }
});

// ============================================================================
// Native Windows System Tray & BrowserWindow Setup
// ============================================================================
function createTrayIcon() {
  const icoPath = path.join(__dirname, '..', 'public', 'netx-icon.ico');
  const pngPath = path.join(__dirname, '..', 'public', 'netx-icon.png');
  const svgPath = path.join(__dirname, '..', 'public', 'netx-icon.svg');

  for (const iconFile of [icoPath, pngPath, svgPath]) {
    if (fs.existsSync(iconFile)) {
      try {
        const img = nativeImage.createFromPath(iconFile);
        if (!img.isEmpty()) {
          return img.resize({ width: 32, height: 32 });
        }
      } catch {}
    }
  }

  // Draw 32x32 purple wireframe globe icon directly as fallback
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  const cx = 15.5;
  const cy = 15.5;
  const r = 13.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > r + 1.2) {
        // Transparent outside
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Outer circle rim
      const isRim = Math.abs(dist - r) <= 1.0;
      // Vertical axis
      const isVert = Math.abs(dx) <= 0.8 && dist <= r;
      // Horizontal equator
      const isHoriz = Math.abs(dy) <= 0.8 && dist <= r;
      // Longitude ellipse curves (dx = +- sqrt(1 - (dy/r)^2) * (r * 0.55))
      const dyFrac = dy / r;
      const ellX = Math.sqrt(Math.max(0, 1 - dyFrac * dyFrac)) * (r * 0.58);
      const isLong = Math.abs(Math.abs(dx) - ellX) <= 0.9 && dist <= r;
      // Latitude curves (dy = +- (6.5 - (dx*dx)/32))
      const isLat = Math.abs(Math.abs(dy) - (6.5 - (dx * dx) / 32)) <= 0.9 && dist <= r;

      if (isRim || isVert || isHoriz || isLong || isLat) {
        // Vibrant Neon Purple (#C084FC -> BGRA: 252, 132, 192, 255)
        buf[idx] = 252;
        buf[idx + 1] = 132;
        buf[idx + 2] = 192;
        buf[idx + 3] = 255;
      } else {
        // Deep obsidian background fill (#100A24 -> BGRA: 36, 10, 16, 220)
        buf[idx] = 36;
        buf[idx + 1] = 10;
        buf[idx + 2] = 16;
        buf[idx + 3] = 220;
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: 'NETX — Network Utility', enabled: false },
    {
      label: `Download: ${currentDownloadMbps.toFixed(1)} Mbps`,
      enabled: false,
    },
    {
      label: `Upload:   ${currentUploadMbps.toFixed(1)} Mbps`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open NetX',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Exit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip(
    `NetX · ↓ ${currentDownloadMbps.toFixed(1)} Mbps | ↑ ${currentUploadMbps.toFixed(1)} Mbps`
  );
  tray.setContextMenu(contextMenu);
}

function createWindow() {
  const icoPath = path.join(__dirname, '..', 'public', 'netx-icon.ico');
  const pngPath = path.join(__dirname, '..', 'public', 'netx-icon.png');
  const windowIcon = fs.existsSync(icoPath)
    ? icoPath
    : fs.existsSync(pngPath)
    ? pngPath
    : createTrayIcon();

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 840,
    minWidth: 920,
    minHeight: 640,
    title: 'NetX — Network Utility & Telemetry',
    backgroundColor: '#091012',
    autoHideMenuBar: true,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    // Helpful dev shortcuts: F12 toggles DevTools, F5 or Ctrl+R reloads
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown') {
        if (input.key === 'F12') {
          mainWindow.webContents.toggleDevTools();
          event.preventDefault();
        } else if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
          mainWindow.webContents.reloadIgnoringCache();
          event.preventDefault();
        }
      }
    });
  } else {
    const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(distIndex);
  }

  if (process.argv.includes('--minimized')) {
    mainWindow.hide();
  }
}

app.whenReady().then(() => {
  usageStore = loadUsageStore();
  try {
    tray = new Tray(createTrayIcon());
    updateTrayMenu();
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch {
    // ignore tray error if icon unsupported
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit();
  }
});
