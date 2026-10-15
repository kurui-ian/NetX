/**
 * NetX Native Intent Matcher
 * Parses natural language commands into verified NetX tool calls.
 * Used for instant command dispatch and offline fallback when Ollama is not running.
 */

export interface MatchedIntent {
  matched: boolean;
  toolName: string;
  args: Record<string, any>;
  title: string;
  userQuery: string;
}

export function matchUserIntent(query: string): MatchedIntent | null {
  const clean = query.trim().toLowerCase();

  // 1. Speed Test
  if (
    /(?:speed\s*test|speedtest|test\s*(?:my|an|the)?\s*(?:internet\s*)?speed|benchmark\s*(?:my\s*)?speed|check\s*(?:my\s*)?speed)/i.test(clean) ||
    clean === 'speed' ||
    clean === 'speedtest'
  ) {
    return {
      matched: true,
      toolName: 'run_speed_test',
      args: {},
      title: 'Running Speed Test',
      userQuery: query,
    };
  }

  // 2. Network Diagnostics / "Why is my internet slow"
  if (
    /(?:why\s+is\s+my\s+internet\s+(?:slow|down|bad|dropping)|diagnose|troubleshoot|health\s*check|check\s+(?:connection|network)|network\s+diagnostic)/i.test(clean)
  ) {
    return {
      matched: true,
      toolName: 'diagnose_network',
      args: {},
      title: 'Diagnosing Network Connection',
      userQuery: query,
    };
  }

  // 3. Ping Host
  const pingMatch = clean.match(/^ping\s+([a-zA-Z0-9.-]+)(?:\s+(-n\s+\d+|\d+))?/i);
  if (pingMatch) {
    const host = pingMatch[1];
    const count = parseInt(pingMatch[2]?.replace(/[^\d]/g, '') || '4', 10);
    return {
      matched: true,
      toolName: 'ping_host',
      args: { host, count: Math.min(10, Math.max(1, count)) },
      title: `Pinging ${host}`,
      userQuery: query,
    };
  }
  if (/latency\s+to\s+([a-zA-Z0-9.-]+)/i.test(clean)) {
    const m = clean.match(/latency\s+to\s+([a-zA-Z0-9.-]+)/i);
    return {
      matched: true,
      toolName: 'ping_host',
      args: { host: m ? m[1] : '1.1.1.1', count: 4 },
      title: `Pinging ${m ? m[1] : '1.1.1.1'}`,
      userQuery: query,
    };
  }

  // 4. DNS Lookup
  const dnsMatch = clean.match(/(?:dns\s*lookup|resolve|check\s*dns\s*for|query\s*dns)\s+([a-zA-Z0-9.-]+)/i);
  if (dnsMatch) {
    return {
      matched: true,
      toolName: 'dns_lookup',
      args: { domain: dnsMatch[1] },
      title: `Resolving DNS for ${dnsMatch[1]}`,
      userQuery: query,
    };
  }
  if (clean === 'check dns' || clean === 'check my dns') {
    return {
      matched: true,
      toolName: 'dns_lookup',
      args: { domain: 'cloudflare.com' },
      title: 'Resolving DNS for cloudflare.com',
      userQuery: query,
    };
  }

  // 5. Traceroute
  const traceMatch = clean.match(/(?:traceroute|tracert|trace\s*route\s*to)\s+([a-zA-Z0-9.-]+)/i);
  if (traceMatch) {
    return {
      matched: true,
      toolName: 'traceroute',
      args: { host: traceMatch[1] },
      title: `Tracing Route to ${traceMatch[1]}`,
      userQuery: query,
    };
  }

  // 6. Disconnect Wi-Fi
  if (/(?:disconnect|turn\s*off).*?wi-?fi/i.test(clean) || clean === 'disconnect wifi') {
    return {
      matched: true,
      toolName: 'disconnect_wifi',
      args: {},
      title: 'Disconnect Wi-Fi',
      userQuery: query,
    };
  }

  // 7. Connect Wi-Fi
  const wifiConnMatch = clean.match(/\b(?:connect\s*(?:me)?\s*(?:to)?)\s*(?:wifi|network)?\s*["']?([a-zA-Z0-9_ -]+)["']?/i);
  if (wifiConnMatch && !clean.includes('disconnect') && !clean.includes('tools')) {
    const rawSsid = wifiConnMatch[1].trim();
    if (rawSsid && rawSsid !== 'wifi' && rawSsid !== 'internet' && rawSsid !== 'network') {
      return {
        matched: true,
        toolName: 'connect_wifi',
        args: { ssid: rawSsid },
        title: `Connecting to Wi-Fi "${rawSsid}"`,
        userQuery: query,
      };
    }
  }

  // 8. Wi-Fi Scan / Available Networks
  if (
    /(?:show|scan|list|find|available|nearby|search)\s+(?:all\s*)?wi-?fi(?:\s*networks)?/i.test(clean) ||
    clean === 'wifi' ||
    clean === 'scan wifi' ||
    clean === 'available wifi' ||
    clean === 'show wifi'
  ) {
    return {
      matched: true,
      toolName: 'list_wifi_networks',
      args: {},
      title: 'Scanning Wi-Fi Networks',
      userQuery: query,
    };
  }

  // 9. Flush DNS Cache
  if (/(?:flush|clear|reset|purge)\s*(?:the|my)?\s*dns(?:\s*(?:resolver\s*)?cache)?/i.test(clean) || clean.includes('flushdns')) {
    return {
      matched: true,
      toolName: 'flush_dns',
      args: {},
      title: 'Flush DNS Cache',
      userQuery: query,
    };
  }

  // 10. Renew DHCP Lease
  if (/(?:renew|refresh|reset|re-acquire)\s*(?:the|my)?\s*(?:dhcp|ip|lease|ip\s*address)/i.test(clean)) {
    return {
      matched: true,
      toolName: 'renew_dhcp',
      args: {},
      title: 'Renew DHCP Lease',
      userQuery: query,
    };
  }

  // 11. LAN Devices / Discover Subnet
  if (
    /(?:find|scan|discover|show|list)\s*(?:devices|lan|computers|clients)?\s*(?:on\s*(?:my\s*)?(?:local\s*)?(?:network|lan|subnet))/i.test(clean) ||
    clean === 'scan lan' ||
    clean === 'find devices'
  ) {
    return {
      matched: true,
      toolName: 'discover_lan_devices',
      args: {},
      title: 'Scanning Local LAN Devices',
      userQuery: query,
    };
  }

  // 12. Active Connections & Apps
  if (
    /(?:show|inspect|list|what\s+apps\s+are\s+using)\s*(?:my\s*)?(?:active\s*)?(?:connections|bandwidth|apps|processes|sockets|traffic)/i.test(clean)
  ) {
    return {
      matched: true,
      toolName: 'get_active_connections',
      args: {},
      title: 'Inspecting Active Connections & Processes',
      userQuery: query,
    };
  }

  // 13. Telemetry / Summary / "Summarize my network"
  if (
    /(?:summarize|overview|status|summary|report|how\s+is\s+my\s+network)\b/i.test(clean) ||
    clean === 'status'
  ) {
    return {
      matched: true,
      toolName: 'get_network_summary',
      args: {},
      title: 'Compiling Network Summary',
      userQuery: query,
    };
  }

  // 14. Export Diagnostic Report
  if (/(?:export|save|download|generate)\s*(?:a\s*)?(?:diagnostic\s*)?report/i.test(clean)) {
    return {
      matched: true,
      toolName: 'export_diagnostic_report',
      args: { format: 'json' },
      title: 'Exporting Diagnostic Report',
      userQuery: query,
    };
  }

  return null;
}
