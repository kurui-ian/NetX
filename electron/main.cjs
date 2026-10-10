const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
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
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {
    // ignore corrupt file
  }
  return {
    lastBootAdapterRx: 0,
    lastBootAdapterTx: 0,
    daily: {}, // 'YYYY-MM-DD': { rxBytes, txBytes }
    hourly: {}, // 'YYYY-MM-DD-HH': { rxBytes, txBytes }
    monthly: {}, // 'YYYY-MM': { rxBytes, txBytes }
    appBytes: {}, // processName: { todayBytes, monthBytes }
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
async function getInterfaceBytes() {
  try {
    // Fast PowerShell one-liner using .NET NetworkInterface 64-bit counters
    const cmd = `powershell -NoProfile -Command "[System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | Where-Object { $_.OperationalStatus -eq 'Up' -and $_.NetworkInterfaceType -ne 'Loopback' } | ForEach-Object { $s = $_.GetIPStatistics(); Write-Output ($_.Name + '|' + $s.BytesReceived + '|' + $s.BytesSent) }"`;
    const { stdout } = await execAsync(cmd, { timeout: 2500 });
    let totalRx = 0;
    let totalTx = 0;
    const lines = stdout.trim().split(/\r?\n/);
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length === 3) {
        totalRx += parseInt(parts[1], 10) || 0;
        totalTx += parseInt(parts[2], 10) || 0;
      }
    }
    if (totalRx > 0 || totalTx > 0) {
      return { rxBytes: totalRx, txBytes: totalTx };
    }
  } catch {
    // Fallback to netstat -e
  }

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

// Update Persistent Usage Store with Real Byte Deltas
function recordBytesDelta(rxBytes, txBytes) {
  if (!usageStore) usageStore = loadUsageStore();

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const hourKey = `${dayKey}-${String(now.getHours()).padStart(2, '0')}`;
  const monthKey = dayKey.slice(0, 7); // YYYY-MM

  // Handle first run or reboot where OS counters reset
  if (
    usageStore.lastBootAdapterRx === 0 ||
    rxBytes < usageStore.lastBootAdapterRx ||
    txBytes < usageStore.lastBootAdapterTx
  ) {
    // Seed today & month with the current OS boot session bytes if empty
    if (!usageStore.daily[dayKey]) {
      usageStore.daily[dayKey] = { rxBytes, txBytes };
    }
    if (!usageStore.monthly[monthKey]) {
      usageStore.monthly[monthKey] = { rxBytes, txBytes };
    }
    if (!usageStore.hourly[hourKey]) {
      usageStore.hourly[hourKey] = { rxBytes: Math.round(rxBytes * 0.25), txBytes: Math.round(txBytes * 0.25) };
    }
    usageStore.lastBootAdapterRx = rxBytes;
    usageStore.lastBootAdapterTx = txBytes;
    saveUsageStore();
    return;
  }

  const deltaRx = Math.max(0, rxBytes - usageStore.lastBootAdapterRx);
  const deltaTx = Math.max(0, txBytes - usageStore.lastBootAdapterTx);

  if (deltaRx > 0 || deltaTx > 0) {
    usageStore.lastBootAdapterRx = rxBytes;
    usageStore.lastBootAdapterTx = txBytes;

    if (!usageStore.daily[dayKey]) usageStore.daily[dayKey] = { rxBytes: 0, txBytes: 0 };
    usageStore.daily[dayKey].rxBytes += deltaRx;
    usageStore.daily[dayKey].txBytes += deltaTx;

    if (!usageStore.hourly[hourKey]) usageStore.hourly[hourKey] = { rxBytes: 0, txBytes: 0 };
    usageStore.hourly[hourKey].rxBytes += deltaRx;
    usageStore.hourly[hourKey].txBytes += deltaTx;

    if (!usageStore.monthly[monthKey]) usageStore.monthly[monthKey] = { rxBytes: 0, txBytes: 0 };
    usageStore.monthly[monthKey].rxBytes += deltaRx;
    usageStore.monthly[monthKey].txBytes += deltaTx;

    saveUsageStore();
  }
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

  if (lastSampleTime > 0 && now > lastSampleTime) {
    const elapsedSec = (now - lastSampleTime) / 1000;
    const dRx = Math.max(0, bytes.rxBytes - lastRxBytes);
    const dTx = Math.max(0, bytes.txBytes - lastTxBytes);
    currentDownloadMbps = Math.round(((dRx * 8) / (elapsedSec * 1_000_000)) * 100) / 100;
    currentUploadMbps = Math.round(((dTx * 8) / (elapsedSec * 1_000_000)) * 100) / 100;
  }

  lastSampleTime = now;
  lastRxBytes = bytes.rxBytes;
  lastTxBytes = bytes.txBytes;

  recordBytesDelta(bytes.rxBytes, bytes.txBytes);

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
  const todayObj = (usageStore && usageStore.daily[dayKey]) || {
    rxBytes: bytes.rxBytes,
    txBytes: bytes.txBytes,
  };
  const monthObj = (usageStore && usageStore.monthly[monthKey]) || {
    rxBytes: bytes.rxBytes,
    txBytes: bytes.txBytes,
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
// IPC 5: Real Speed Test Engine against Cloudflare Edge (`netx:run-speed-test`)
// ============================================================================
ipcMain.handle('netx:run-speed-test', async (event) => {
  const sendProgress = (payload) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('netx:speed-test-progress', payload);
    }
  };

  try {
    // Stage 1: Real Ping & Jitter (4 probes to 1.1.1.1)
    sendProgress({ stage: 'ping', progress: 5, liveValue: 0 });
    const pings = [];
    for (let i = 0; i < 4; i++) {
      const res = await measureQuickPing('1.1.1.1');
      if (res.alive) pings.push(res.timeMs);
      sendProgress({
        stage: 'ping',
        progress: 5 + (i + 1) * 4,
        liveValue: res.timeMs || 20,
      });
    }

    if (pings.length === 0) {
      throw new Error('ICMP & HTTPS reachability check to 1.1.1.1 failed.');
    }

    const avgPing = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
    let jitterSum = 0;
    for (let i = 1; i < pings.length; i++) {
      jitterSum += Math.abs(pings[i] - pings[i - 1]);
    }
    const jitterMs =
      pings.length > 1 ? Math.round((jitterSum / (pings.length - 1)) * 10) / 10 : 1.0;

    // Stage 2: Real HTTPS Download Benchmark (speed.cloudflare.com/__down)
    sendProgress({
      stage: 'download',
      progress: 22,
      liveValue: 0,
      pingMs: avgPing,
      jitterMs,
    });

    const downloadMbps = await new Promise((resolve, reject) => {
      let bytesReceived = 0;
      const startTime = Date.now();
      const durationLimitMs = 5500;
      let finished = false;

      const finishDownload = () => {
        if (finished) return;
        finished = true;
        const elapsedSec = Math.max(0.2, (Date.now() - startTime) / 1000);
        const mbps = Math.round(((bytesReceived * 8) / (elapsedSec * 1_000_000)) * 10) / 10;
        resolve(mbps);
      };

      const req = https.get(
        'https://speed.cloudflare.com/__down?bytes=25000000',
        { timeout: 8000 },
        (res) => {
          res.on('data', (chunk) => {
            bytesReceived += chunk.length;
            const elapsed = Date.now() - startTime;
            if (elapsed > 150) {
              const liveMbps =
                Math.round(((bytesReceived * 8) / ((elapsed / 1000) * 1_000_000)) * 10) / 10;
              const pct = Math.min(64, 22 + Math.round((elapsed / durationLimitMs) * 42));
              sendProgress({
                stage: 'download',
                progress: pct,
                liveValue: liveMbps,
                pingMs: avgPing,
                jitterMs,
              });
            }
            if (elapsed >= durationLimitMs) {
              req.destroy();
              finishDownload();
            }
          });
          res.on('end', finishDownload);
          res.on('error', finishDownload);
        }
      );

      req.on('error', (err) => {
        if (bytesReceived > 0) finishDownload();
        else reject(err);
      });
    });

    // Stage 3: Real HTTPS Upload Benchmark (speed.cloudflare.com/__up)
    sendProgress({
      stage: 'upload',
      progress: 66,
      liveValue: 0,
      pingMs: avgPing,
      jitterMs,
      downloadMbps,
    });

    const uploadMbps = await new Promise((resolve) => {
      const payloadSize = 2 * 1024 * 1024; // 2 MB buffer
      const chunkSize = 64 * 1024;
      const buf = Buffer.alloc(chunkSize, 'x');
      let bytesSent = 0;
      const startTime = Date.now();

      const req = https.request(
        'https://speed.cloudflare.com/__up',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': payloadSize,
          },
          timeout: 7000,
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            const elapsedSec = Math.max(0.15, (Date.now() - startTime) / 1000);
            const mbps = Math.round(((bytesSent * 8) / (elapsedSec * 1_000_000)) * 10) / 10;
            resolve(mbps);
          });
        }
      );

      req.on('error', () => {
        const elapsedSec = Math.max(0.15, (Date.now() - startTime) / 1000);
        const mbps = Math.round(((bytesSent * 8) / (elapsedSec * 1_000_000)) * 10) / 10;
        resolve(mbps);
      });

      const writeNext = () => {
        while (bytesSent < payloadSize) {
          const ok = req.write(buf);
          bytesSent += chunkSize;
          const elapsed = Math.max(50, Date.now() - startTime);
          const liveMbps =
            Math.round(((bytesSent * 8) / ((elapsed / 1000) * 1_000_000)) * 10) / 10;
          const pct = Math.min(98, 66 + Math.round((bytesSent / payloadSize) * 32));
          sendProgress({
            stage: 'upload',
            progress: pct,
            liveValue: liveMbps,
            pingMs: avgPing,
            jitterMs,
            downloadMbps,
          });
          if (!ok) {
            req.once('drain', writeNext);
            return;
          }
        }
        req.end();
      };

      writeNext();
    });

    const wifi = await getWifiInterfaceInfo();
    const pubIp = await fetchPublicIp();

    return {
      ok: true,
      pingMs: avgPing,
      jitterMs,
      downloadMbps,
      uploadMbps,
      server: pubIp.isp || 'Cloudflare Speed Edge',
      interfaceName: wifi?.connected ? `Wi-Fi (${wifi.ssid})` : 'Primary Adapter',
    };
  } catch (err) {
    return {
      ok: false,
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
// IPC 7: Real Network Tools (`netx:run-tool`: ping, traceroute, dns, port)
// ============================================================================
ipcMain.handle('netx:run-tool', async (_event, { tool, target }) => {
  const cleanTarget = String(target || 'cloudflare.com')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .trim();

  if (tool === 'ping') {
    try {
      const { stdout } = await execAsync(`ping -n 4 -w 2000 ${cleanTarget}`, { timeout: 10000 });
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
      return { ok: true, rows, raw: stdout };
    } catch (err) {
      return { ok: false, rows: [], raw: err.stdout || String(err) };
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
    lastBootAdapterRx: lastRxBytes,
    lastBootAdapterTx: lastTxBytes,
    daily: {},
    hourly: {},
    monthly: {},
    appBytes: {},
  };
  saveUsageStore();
  return { ok: true };
});

ipcMain.handle('netx:quit-app', () => {
  isQuitting = true;
  app.quit();
});

// ============================================================================
// Native Windows System Tray & BrowserWindow Setup
// ============================================================================
function createTrayIcon() {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Rounded square mask
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      if (dx + dy < 4) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }
      // Pulse line across middle
      const isPulse =
        (y >= 15 && y <= 17 && x >= 5 && x <= 10) ||
        (Math.abs(y - (22 - (x - 10) * 2)) <= 1.6 && x >= 10 && x <= 15) ||
        (Math.abs(y - (12 + (x - 15) * 2.2)) <= 1.6 && x >= 15 && x <= 20) ||
        (y >= 15 && y <= 17 && x >= 20 && x <= 26);

      if (isPulse) {
        // Mint (#2DD4BF -> BGRA: 191, 212, 45, 255)
        buf[idx] = 191;
        buf[idx + 1] = 212;
        buf[idx + 2] = 45;
        buf[idx + 3] = 255;
      } else {
        // Deep Petrol Teal (#0B3B3C -> BGRA: 60, 59, 11, 255)
        buf[idx] = 60;
        buf[idx + 1] = 59;
        buf[idx + 2] = 11;
        buf[idx + 3] = 255;
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
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 840,
    minWidth: 920,
    minHeight: 640,
    title: 'NetX — Network Utility & Telemetry',
    backgroundColor: '#091012',
    autoHideMenuBar: true,
    icon: createTrayIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(distIndex);

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
