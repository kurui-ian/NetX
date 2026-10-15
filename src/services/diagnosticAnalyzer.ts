/**
 * NetX Diagnostic Reasoning Engine
 * Evaluates real measurement findings from network checks, speed tests, and telemetry.
 * Computes root-cause fault domains, confidence levels, evidence citations, and targeted repairs.
 */

export type FaultDomain =
  | 'Local Adapter / Hardware'
  | 'Local Gateway / Router'
  | 'DNS Resolution Service'
  | 'WAN / ISP Routing'
  | 'Wi-Fi Signal Degraded'
  | 'Healthy (No Fault Detected)';

export interface DiagnosticAnalysis {
  faultDomain: FaultDomain;
  confidence: 'High (95%)' | 'Medium (75%)' | 'Inconclusive (<60%)';
  status: 'healthy' | 'warning' | 'critical';
  summary: string;
  evidence: string[];
  recommendations: string[];
  suggestedAction?: {
    toolName: string;
    label: string;
    args?: any;
    description: string;
  };
}

export function analyzeDiagnosticResults(data: {
  steps?: {
    adapter?: { passed: boolean; detail?: string; tech?: string };
    gateway?: { passed: boolean; detail?: string; tech?: string };
    dns?: { passed: boolean; detail?: string; tech?: string };
    internet?: { passed: boolean; detail?: string; tech?: string };
  };
  telemetry?: any;
  speedTest?: any;
}): DiagnosticAnalysis {
  const steps = data.steps || {};
  const adapter = steps.adapter;
  const gateway = steps.gateway;
  const dns = steps.dns;
  const internet = steps.internet;

  const evidence: string[] = [];

  // 1. Adapter check
  if (adapter) {
    if (!adapter.passed) {
      return {
        faultDomain: 'Local Adapter / Hardware',
        confidence: 'High (95%)',
        status: 'critical',
        summary: 'Your network adapter has no valid IP configuration or is disconnected.',
        evidence: [
          'Adapter status: Disconnected / APIPA',
          adapter.tech || adapter.detail || 'No IPv4 address assigned',
        ],
        recommendations: [
          'Ensure your Wi-Fi is toggled ON or your Ethernet cable is securely plugged in.',
          'Try renewing your IP configuration using DHCP renew.',
        ],
        suggestedAction: {
          toolName: 'renew_dhcp',
          label: 'Renew DHCP Lease',
          description: 'Re-acquire an IP lease from your router.',
        },
      };
    }
    evidence.push(`Adapter: Connected (${adapter.detail})`);
  }

  // 2. Gateway check
  if (gateway) {
    if (!gateway.passed) {
      return {
        faultDomain: 'Local Gateway / Router',
        confidence: 'High (95%)',
        status: 'critical',
        summary: 'Your device is connected to the adapter, but cannot reach your local default gateway (router).',
        evidence: [
          'Local router / default gateway did not reply to ICMP echo requests.',
          gateway.tech || gateway.detail || 'Gateway RTT: Timed Out',
        ],
        recommendations: [
          'Check the power and physical status lights on your Wi-Fi router / modem.',
          'If on Wi-Fi, try disconnecting and reconnecting to refresh the wireless association.',
          'Restart your router if it remains unresponsive.',
        ],
        suggestedAction: {
          toolName: 'disconnect_wifi',
          label: 'Reconnect Wi-Fi',
          description: 'Cycle your wireless link association.',
        },
      };
    }
    evidence.push(`Gateway: Reachable (${gateway.detail})`);
  }

  // 3. DNS check
  if (dns) {
    if (!dns.passed) {
      return {
        faultDomain: 'DNS Resolution Service',
        confidence: 'High (95%)',
        status: 'critical',
        summary: 'Local network and router are reachable, but DNS name resolution is failing.',
        evidence: [
          'Router is reachable via ICMP, but DNS query for domain names failed.',
          dns.tech || dns.detail || 'DNS resolve error',
        ],
        recommendations: [
          'Flush your local Windows DNS cache to clear any corrupt or stale entries.',
          'Consider configuring public fallback DNS servers (such as Cloudflare 1.1.1.1 or Google 8.8.8.8).',
        ],
        suggestedAction: {
          toolName: 'flush_dns',
          label: 'Flush DNS Cache',
          description: 'Clear local resolver cache with ipconfig /flushdns',
        },
      };
    }
    evidence.push(`DNS: Resolved successfully (${dns.detail})`);
  }

  // 4. Internet WAN check
  if (internet) {
    if (!internet.passed) {
      return {
        faultDomain: 'WAN / ISP Routing',
        confidence: 'Medium (75%)',
        status: 'critical',
        summary: 'Local router and DNS respond, but external WAN transit to global internet hosts is blocked.',
        evidence: [
          'Local LAN and DNS are functional, but public IP / ICMP WAN ping failed.',
          internet.tech || internet.detail || 'External internet unreachable',
        ],
        recommendations: [
          'Your Internet Service Provider (ISP) may be experiencing an upstream outage or fiber cut.',
          'Check your modem WAN/Internet indicator LED light.',
          'Contact your ISP to verify line status.',
        ],
      };
    }
    evidence.push(`Internet: Reachable (${internet.detail})`);
  }

  // 5. Wi-Fi signal inspection (if applicable)
  const wifi = data.telemetry?.wifi;
  if (wifi && wifi.connected && typeof wifi.signalQuality === 'number' && wifi.signalQuality < 35) {
    return {
      faultDomain: 'Wi-Fi Signal Degraded',
      confidence: 'Medium (75%)',
      status: 'warning',
      summary: `Your Wi-Fi signal quality is very weak (${wifi.signalQuality}%, ${wifi.signalDbm} dBm), causing packet retransmissions and jitter.`,
      evidence: [
        `Connected to SSID: ${wifi.ssid} (${wifi.band})`,
        `Signal Quality: ${wifi.signalQuality}% (${wifi.signalDbm} dBm)`,
        `Link Speed: ${wifi.linkSpeedMbps} Mbps`,
      ],
      recommendations: [
        'Move closer to your wireless router or access point.',
        'Avoid physical obstructions such as thick concrete walls or metal appliances.',
        'If supported, switch to the 5 GHz band for less congestion or 2.4 GHz for greater range.',
      ],
      suggestedAction: {
        toolName: 'list_wifi_networks',
        label: 'Scan Wi-Fi Spectrum',
        description: 'Check available bands and channels.',
      },
    };
  }

  // All baseline checks passed
  return {
    faultDomain: 'Healthy (No Fault Detected)',
    confidence: 'High (95%)',
    status: 'healthy',
    summary: 'All network diagnostics passed. Adapter, local gateway, DNS resolution, and global internet routing are functioning normally.',
    evidence,
    recommendations: [
      'Your network topology is healthy and operating within normal operational tolerances.',
      'Run a speed test if you wish to verify bandwidth throughput.',
    ],
    suggestedAction: {
      toolName: 'run_speed_test',
      label: 'Run Speed Benchmark',
      description: 'Test live download, upload, and latency.',
    },
  };
}
