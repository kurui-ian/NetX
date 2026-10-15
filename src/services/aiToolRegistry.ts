/**
 * NetX AI Tool Registry
 * Strictly typed, validated registry of real network tools accessible to Ollama and NetX AI.
 * NEVER allows arbitrary shell execution or unsafe system manipulation.
 */

export interface ToolParameterDef {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterDef>;
    required?: string[];
  };
  requiresConfirmation: boolean;
  dangerLevel: 'none' | 'low' | 'medium' | 'high';
  confirmationPrompt?: (args: any) => string;
  validateArgs: (args: any) => { valid: boolean; error?: string; cleanArgs?: any };
  execute: (args: any, context?: any) => Promise<any>;
}

// Sanitization helpers
function cleanHost(val: any): string {
  if (typeof val !== 'string') return 'cloudflare.com';
  const firstPart = val.split(/[\s;&|`$><]+/)[0] || '';
  return firstPart.replace(/[^a-zA-Z0-9.-]/g, '').slice(0, 120) || 'cloudflare.com';
}

function cleanDomain(val: any): string {
  if (typeof val !== 'string') return 'cloudflare.com';
  const firstPart = val.split(/[\s;&|`$><]+/)[0] || '';
  return firstPart.replace(/[^a-zA-Z0-9.-]/g, '').slice(0, 120) || 'cloudflare.com';
}

export const NETX_AI_TOOLS: ToolDefinition[] = [
  // 1. Run Speed Test
  {
    name: 'run_speed_test',
    displayName: 'Speed Test',
    description: 'Runs a real multi-stage speed test measuring download throughput (Mbps), upload throughput (Mbps), ping latency (ms), and jitter (ms) against Cloudflare edge servers.',
    parameters: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'Measurement server endpoint name (optional).',
        },
      },
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: (args) => ({ valid: true, cleanArgs: args || {} }),
    execute: async (args) => {
      if (!window.netxNative?.runSpeedTest) {
        throw new Error('Native speed test service unavailable');
      }
      return await window.netxNative.runSpeedTest(args);
    },
  },

  // 2. Get Live Network Summary & Telemetry
  {
    name: 'get_network_summary',
    displayName: 'Network Telemetry Snapshot',
    description: 'Retrieves current real-time telemetry: active network adapter, IP addresses, default gateway, DNS servers, public IP, Wi-Fi link speed & signal, bandwidth throughput, and daily data usage.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: () => ({ valid: true, cleanArgs: {} }),
    execute: async () => {
      if (!window.netxNative?.getTelemetry) {
        throw new Error('Native telemetry service unavailable');
      }
      return await window.netxNative.getTelemetry();
    },
  },

  // 3. Diagnose Network
  {
    name: 'diagnose_network',
    displayName: 'Comprehensive Network Diagnostics',
    description: 'Runs a full 4-stage network diagnostic check investigating: adapter configuration, default gateway reachability, DNS name resolution, and WAN internet connectivity.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: () => ({ valid: true, cleanArgs: {} }),
    execute: async () => {
      if (!window.netxNative?.runDiagnosticStep) {
        throw new Error('Native diagnostic service unavailable');
      }
      const [adapter, gateway, dns, internet] = await Promise.all([
        window.netxNative.runDiagnosticStep('adapter'),
        window.netxNative.runDiagnosticStep('gateway'),
        window.netxNative.runDiagnosticStep('dns'),
        window.netxNative.runDiagnosticStep('internet'),
      ]);
      return {
        timestamp: new Date().toISOString(),
        steps: { adapter, gateway, dns, internet },
        overallPassed: adapter.passed && gateway.passed && dns.passed && internet.passed,
      };
    },
  },

  // 4. Ping Host
  {
    name: 'ping_host',
    displayName: 'Ping Host',
    description: 'Sends ICMP echo requests to a destination host or IP address to measure round-trip latency, packet loss, and TTL.',
    parameters: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Hostname or IPv4 address to ping (e.g. "1.1.1.1", "google.com").',
          required: true,
        },
        count: {
          type: 'number',
          description: 'Number of ICMP packets to send (1 to 10, default 4).',
        },
      },
      required: ['host'],
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: (args) => {
      const host = cleanHost(args?.host);
      const count = Math.min(10, Math.max(1, parseInt(args?.count, 10) || 4));
      return { valid: true, cleanArgs: { host, count } };
    },
    execute: async (cleanArgs) => {
      if (!window.netxNative?.runTool) throw new Error('Tool service unavailable');
      return await window.netxNative.runTool('ping', cleanArgs.host, { count: cleanArgs.count });
    },
  },

  // 5. DNS Lookup
  {
    name: 'dns_lookup',
    displayName: 'DNS Lookup',
    description: 'Performs DNS resolution on a domain name, querying standard records (A, AAAA, MX, NS, TXT).',
    parameters: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name to resolve (e.g. "github.com", "cloudflare.com").',
          required: true,
        },
      },
      required: ['domain'],
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: (args) => {
      const domain = cleanDomain(args?.domain);
      return { valid: true, cleanArgs: { domain } };
    },
    execute: async (cleanArgs) => {
      if (!window.netxNative?.runTool) throw new Error('Tool service unavailable');
      return await window.netxNative.runTool('dns', cleanArgs.domain);
    },
  },

  // 6. Traceroute
  {
    name: 'traceroute',
    displayName: 'Traceroute',
    description: 'Traces the network hops and per-hop latency from your computer to a destination IP or hostname.',
    parameters: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Destination hostname or IP to trace (e.g. "1.1.1.1").',
          required: true,
        },
      },
      required: ['host'],
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: (args) => {
      const host = cleanHost(args?.host);
      return { valid: true, cleanArgs: { host } };
    },
    execute: async (cleanArgs) => {
      if (!window.netxNative?.runTool) throw new Error('Tool service unavailable');
      return await window.netxNative.runTool('traceroute', cleanArgs.host);
    },
  },

  // 7. Port Reachability Check
  {
    name: 'port_check',
    displayName: 'Port Reachability Check',
    description: 'Checks common TCP service ports (80 HTTP, 443 HTTPS, 53 DNS, 22 SSH, 3389 RDP) on a target host.',
    parameters: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Target IP or domain to test ports against.',
          required: true,
        },
      },
      required: ['host'],
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: (args) => {
      const host = cleanHost(args?.host);
      return { valid: true, cleanArgs: { host } };
    },
    execute: async (cleanArgs) => {
      if (!window.netxNative?.runTool) throw new Error('Tool service unavailable');
      return await window.netxNative.runTool('port', cleanArgs.host);
    },
  },

  // 8. List Wi-Fi Networks
  {
    name: 'list_wifi_networks',
    displayName: 'Scan Wi-Fi Networks',
    description: 'Scans all available 2.4 GHz and 5 GHz wireless networks in range, reporting SSIDs, BSSIDs, signal quality (%), RSSI dBm, band, and encryption ciphers.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: () => ({ valid: true, cleanArgs: {} }),
    execute: async () => {
      if (!window.netxNative?.getWifiNetworks) throw new Error('Wi-Fi service unavailable');
      return await window.netxNative.getWifiNetworks(true);
    },
  },

  // 9. Get Wi-Fi Status
  {
    name: 'get_wifi_status',
    displayName: 'Get Wi-Fi Status',
    description: 'Inspects current Wi-Fi adapter state, connected SSID, BSSID, channel, radio type (802.11ax/ac/n), transmit/receive rates, and signal strength.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: () => ({ valid: true, cleanArgs: {} }),
    execute: async () => {
      if (!window.netxNative?.getWifiNetworks) throw new Error('Wi-Fi service unavailable');
      const res = await window.netxNative.getWifiNetworks(false);
      return res?.currentInterface || { connected: false, detail: 'No wireless adapter or disconnected.' };
    },
  },

  // 10. Discover LAN Devices
  {
    name: 'discover_lan_devices',
    displayName: 'Scan Local Devices (LAN)',
    description: 'Discovers active devices connected to the local subnet using an authorized ICMP sweep and ARP table inspection.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: () => ({ valid: true, cleanArgs: {} }),
    execute: async () => {
      if (!window.netxNative?.getLanDevices) throw new Error('LAN scanner unavailable');
      return await window.netxNative.getLanDevices(true);
    },
  },

  // 11. Get Active Connections & Applications
  {
    name: 'get_active_connections',
    displayName: 'Inspect Sockets & Apps',
    description: 'Lists active TCP/UDP endpoints, remote hostnames, and process bandwidth consumption on this computer.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: () => ({ valid: true, cleanArgs: {} }),
    execute: async () => {
      if (!window.netxNative?.getConnectionsAndApps) throw new Error('Process inspector unavailable');
      return await window.netxNative.getConnectionsAndApps();
    },
  },

  // 12. Flush DNS Cache (Requires Confirmation)
  {
    name: 'flush_dns',
    displayName: 'Flush DNS Cache',
    description: 'Clears and resets the Windows DNS client resolver cache using "ipconfig /flushdns". Useful when experiencing stale DNS records or hostname errors.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: true,
    dangerLevel: 'low',
    confirmationPrompt: () => 'The assistant wants to flush your Windows DNS resolver cache. This will clear cached domain names without interrupting active network traffic. Proceed?',
    validateArgs: () => ({ valid: true, cleanArgs: {} }),
    execute: async () => {
      if (!window.netxNative?.flushDns) throw new Error('Flush DNS unavailable');
      return await window.netxNative.flushDns();
    },
  },

  // 13. Renew DHCP Lease (Requires Confirmation)
  {
    name: 'renew_dhcp',
    displayName: 'Renew DHCP Lease',
    description: 'Releases and renews the local IP address lease from the DHCP router using "ipconfig /renew". May momentarily disconnect network connections.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: true,
    dangerLevel: 'medium',
    confirmationPrompt: () => 'The assistant wants to renew your network adapter IP address lease from your router ("ipconfig /renew"). This will momentarily disconnect active connections for 2 to 5 seconds. Proceed?',
    validateArgs: () => ({ valid: true, cleanArgs: {} }),
    execute: async () => {
      if (!window.netxNative?.renewDhcp) throw new Error('Renew DHCP unavailable');
      return await window.netxNative.renewDhcp();
    },
  },

  // 14. Disconnect Wi-Fi (Requires Confirmation)
  {
    name: 'disconnect_wifi',
    displayName: 'Disconnect Wi-Fi',
    description: 'Disconnects your computer from the currently associated Wi-Fi network.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: true,
    dangerLevel: 'medium',
    confirmationPrompt: () => 'The assistant wants to disconnect from your active Wi-Fi network. This will terminate your wireless internet connection. Proceed?',
    validateArgs: () => ({ valid: true, cleanArgs: {} }),
    execute: async () => {
      if (!window.netxNative?.disconnectWifi) throw new Error('Wi-Fi disconnect unavailable');
      return await window.netxNative.disconnectWifi();
    },
  },

  // 15. Connect Wi-Fi (Interactive / Safe)
  {
    name: 'connect_wifi',
    displayName: 'Connect to Wi-Fi',
    description: 'Connects to a specified Wi-Fi SSID. If the network is secured and not previously saved in Windows, a dedicated secure password dialog will be shown in the UI.',
    parameters: {
      type: 'object',
      properties: {
        ssid: {
          type: 'string',
          description: 'Name of the Wi-Fi network (SSID) to connect to.',
          required: true,
        },
      },
      required: ['ssid'],
    },
    requiresConfirmation: false,
    dangerLevel: 'low',
    validateArgs: (args) => {
      if (!args?.ssid || typeof args.ssid !== 'string') {
        return { valid: false, error: 'SSID is required' };
      }
      return { valid: true, cleanArgs: { ssid: args.ssid.trim() } };
    },
    execute: async (cleanArgs) => {
      if (!window.netxNative?.connectWifi) throw new Error('Wi-Fi connection service unavailable');
      return await window.netxNative.connectWifi(cleanArgs.ssid, cleanArgs.password);
    },
  },

  // 16. Export Diagnostic Report
  {
    name: 'export_diagnostic_report',
    displayName: 'Export Diagnostic Report',
    description: 'Generates and saves a complete, timestamped diagnostic report of your system, interfaces, and network metrics to a file.',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'txt'],
          description: 'Report export format (default: "json").',
        },
      },
    },
    requiresConfirmation: false,
    dangerLevel: 'none',
    validateArgs: (args) => ({
      valid: true,
      cleanArgs: { format: args?.format === 'txt' ? 'txt' : 'json' },
    }),
    execute: async (cleanArgs) => {
      if (!window.netxNative?.exportDiagnosticReport) throw new Error('Export service unavailable');
      const telemetry = (await window.netxNative.getTelemetry?.()) || {};
      return await window.netxNative.exportDiagnosticReport(telemetry, cleanArgs.format);
    },
  },
];

export function getOllamaToolsSchema() {
  return NETX_AI_TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function findToolByName(name: string): ToolDefinition | undefined {
  return NETX_AI_TOOLS.find((t) => t.name === name);
}
