# NetX — IPC API Reference & Protocol Specification

This document details the native Electron IPC protocol implemented between the Electron main process (`electron/main.cjs`), preload isolation boundary (`electron/preload.cjs`), and the React presentation layer.

## Channel Summary

| Channel Name | Direction | Elevation | Description |
|---|---|---|---|
| `netx:get-telemetry` | Invoke/Reply | Normal | Retrieves live interface throughput, gateway/DNS ping, and data usage counters. |
| `netx:scan-wifi` | Invoke/Reply | Normal | Commands native Win32 `WlanScan` channel sweep and returns visible BSSIDs. |
| `netx:connect-wifi` | Invoke/Reply | Normal | Generates a temporary WLAN profile and connects to an SSID with credentials. |
| `netx:disconnect-wifi` | Invoke/Reply | Normal | Terminates current Wi-Fi association via `netsh wlan disconnect`. |
| `netx:scan-lan` | Invoke/Reply | Normal | Performs ARP cache scan and subnet device discovery. |
| `netx:ping-host` | Invoke/Reply | Normal | Executes standard ICMP ping to a target host with min/avg/max latency. |
| `netx:traceroute` | Invoke/Reply | Normal | Maps WAN hops to a destination endpoint using `tracert -d -w 1000`. |
| `netx:dns-lookup` | Invoke/Reply | Normal | Resolves A, AAAA, MX, NS, and TXT records for a domain name. |
| `netx:flush-dns` | Invoke/Reply | Normal | Purges DNS client cache using `Clear-DnsClientCache`. |
| `netx:renew-dhcp` | Invoke/Reply | Normal | Releases and renews IP lease from local DHCP router. |
| `netx:gemini-chat` | Invoke/Reply | Normal | Secure HTTPS proxy to Google Gemini Flash API with tool calling support. |
| `netx:speed-test` | Invoke/Reply | Normal | Multi-stream HTTPS benchmark against Cloudflare Anycast Edge. |

---

## Detailed Channel Schemas

### `netx:get-telemetry`
**Request Payload**: None.
**Response**:
```typescript
interface TelemetryPayload {
  timestamp: string;
  connected: boolean;
  internetReachable: boolean;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  gatewayPingMs: number;
  dnsPingMs: number;
  rawRxBytes: number;
  rawTxBytes: number;
  todayDownloadGb: number;
  todayUploadGb: number;
  todayTotalGb: number;
  monthTotalGb: number;
  network: RealNetworkInfo;
}
```

### `netx:scan-wifi`
**Request Payload**: `rescan: boolean` (default: `true`).
**Response**:
```typescript
interface WifiScanResult {
  currentInterface: WifiInterfaceInfo | null;
  networks: Array<{
    id: string;
    ssid: string;
    bssid: string;
    signalQuality: number;
    signalDbm: number;
    band: string;
    channel: string;
    security: string;
    linkSpeedMbps: number;
    connected: boolean;
  }>;
}
```

### `netx:flush-dns`
**Request Payload**: None.
**Response**:
```typescript
interface FlushDnsResult {
  ok: boolean;
  output?: string;
  error?: string;
}
```
Uses Windows PowerShell `Clear-DnsClientCache` to eliminate administrative elevation prompts.
