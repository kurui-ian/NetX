# NetX — Native Windows Desktop Network Utility (`NetX.exe`)

[![Platform: Windows x64](https://img.shields.io/badge/Platform-Windows%20x64-0078D6.svg?logo=windows&logoColor=white)](https://github.com/kurui-ian/NetX)
[![Electron: 33.x](https://img.shields.io/badge/Electron-33.x-47848F.svg?logo=electron&logoColor=white)](https://electronjs.org)
[![React: 18.x](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript: 5.x](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind: 3.4](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

NetX is a standalone Windows `.exe` desktop network utility engineered for network administrators, developers, and power users. Built on Electron 33 and React 18, it reads **100% real system and network telemetry** directly from the Windows kernel and native subsystem with zero simulated or synthetic values.

---

## 🌟 Key Capabilities

### 1. Real-Time Hardware & Interface Telemetry
- **Kernel-level Throughput**: Polls 64-bit Windows `.NET` `NetworkInterface.GetIPStatistics()` and `netstat -e` counters to calculate microsecond-accurate real-time Download and Upload bandwidth (`Mbps`).
- **Active Native Wi-Fi Scanner**: Integrates a native compiled C++ scanner (`bin/wlanscan.exe`) invoking Win32 Native Wi-Fi API (`wlanapi.dll` `WlanScan` / `WlanGetNetworkBssList`) to force hardware BSSID scans on demand, bypassing stale OS caches.
- **Wireless Link State**: Inspects connected SSID, AP BSSID, 2.4/5/6 GHz frequency bands, Wi-Fi channel numbers, radio standards (802.11ax/ac/n), WPA2/WPA3 ciphers, signal percentage, RSSI (`dBm`), and PHY link transmission rates.
- **Interface & Gateway Audit**: Parses `ipconfig /all` for all network adapters, IPv4/Subnet, Link-local IPv6, MAC hardware addresses, DHCP lease information, Default Gateway latency, and active DNS resolvers.

### 2. Edge Speed Test Engine
- Benchmarks real latency, jitter, and transfer rates against Anycast edge servers (`speed.cloudflare.com/__down` & `speed.cloudflare.com/__up`).
- Multi-stream chunking with live transfer rate metrics and real-time canvas visualizations.

### 3. Native Active Sockets & Process Attribution
- Correlates live Windows `netstat -ano` TCP/UDP sockets with running processes from `tasklist /FO CSV`.
- Identifies remote endpoint IP addresses, active ports, connection states (`ESTABLISHED`, `LISTENING`, `TIME_WAIT`), process PIDs, and resolves remote hostnames via non-blocking reverse DNS.

### 4. Hybrid Local/Cloud AI Network Troubleshooter
- Powered by Google Gemini (`gemini-2.5-flash` / `gemini-3.5-flash-lite`) with local heuristic fallback.
- **Tool Calling Architecture**: Performs real diagnostic queries (`ping`, `traceroute`, `dns_lookup`, `port_check`, `wifi_scan`, `clear_dns_cache`).
- **Human-in-the-Loop Safeguards**: Interactive visual action cards with user confirmation for any disruptive network operations (e.g. DNS resolver cache flushing).

### 5. Persistent Local Data Usage Analytics
- Continuous tracking of inbound and outbound network bytes into a local persistent store (`%APPDATA%\NetX\netx-usage-store.json`).
- Visualized across Hourly (24h), Daily (7-day), and Monthly aggregates.

### 6. Interactive Network Diagnostics Suite
- Standard multi-hop Traceroute (`tracert.exe`).
- Precision ICMP Ping with min/max/avg latency and packet loss metrics.
- TCP Socket Port Probing (`net.Socket`) across standard ports (HTTP, HTTPS, SSH, DNS, RDP, etc.).
- Complete DNS record introspection (`A`, `AAAA`, `CNAME`, `MX`, `NS`, `TXT`, `SOA`, `SRV`).

---

## 📐 Architecture & Engineering Documentation

Explore the comprehensive technical documentation in the [`docs/`](file:///c:/Projects/NetX/docs) directory:

| Document | Purpose |
| :--- | :--- |
| 📘 [**Architecture Specification**](file:///c:/Projects/NetX/docs/ARCHITECTURE.md) | Multi-tier architectural topology, process isolation boundaries, IPC contracts, and security sandbox model. |
| 🔌 [**IPC API Reference**](file:///c:/Projects/NetX/docs/API_REFERENCE.md) | Exhaustive parameter specifications, payload schemas, and event contracts for all 12 Electron IPC channels. |
| 🌐 [**Networking Guide**](file:///c:/Projects/NetX/docs/NETWORKING_GUIDE.md) | Mathematical formulas for jitter and throughput, 4-stage fault-isolation taxonomy, and Windows network troubleshooting. |

---

## ⚡ Development & Verification

### Running the Live Dev Environment

```powershell
# Launch Vite HMR + Electron desktop window
npm run dev

# Or launch via the one-click Windows launcher
.\dev.bat
```

- **Instant Hot Module Replacement (HMR)**: Edits in `src/` update instantly without losing component state.
- **Electron Watcher**: Changes in `electron/` automatically reload the native window.
- **Developer Tools**: Press `F12` to toggle Chrome DevTools; press `F5` or `Ctrl+R` to force reload.

### Automated Test Suites

NetX includes comprehensive automated test suites covering AI tool calling, conversational intent pipelines, and network data formatters:

```powershell
# Run the complete test suite
npm run test:all

# Or run individual verification suites:
npx tsx tests/formatters.test.ts
npx tsx tests/ai-conversational-suite.ts
npx tsx tests/ai-assistant-suite.ts
```

### CLI Telemetry Benchmark

NetX includes a standalone Node.js CLI script to benchmark interface counters and ICMP pings without launching Electron:

```powershell
node scripts/benchmark-cli.mjs
```

---

## 📦 Building & Packaging Standalone Executables

```powershell
# 1. Compile frontend assets
npm run build

# 2. Package standalone Windows executable
npm run package:exe

# Generated executable:
.\release\NetX-win32-x64\NetX.exe
```

---

## 🛡️ Security & Privacy Notice

- **Zero Data Harvesting**: NetX operates completely locally on your machine.
- **Encrypted Local Storage**: AI API keys and user preferences reside exclusively in local machine storage (`localStorage` and `%APPDATA%\NetX`).
- **Read-Only Telemetry**: Telemetry queries do not modify system routing tables, network adapter states, or firewall rules without explicit user confirmation.

---

## 📄 License

NetX is licensed under the [MIT License](LICENSE).
