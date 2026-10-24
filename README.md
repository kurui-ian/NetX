# NetX — Native Windows Desktop Network Utility (`NetX.exe`)

NetX is a standalone Windows `.exe` desktop network utility that reads **100% real system and network telemetry** directly from your Windows PC with zero simulated or guessed values.

## Real Windows Telemetry & Capabilities

- **Live Interface Bandwidth (`netx:get-telemetry`)**:
  - Polls 64-bit Windows `.NET` `NetworkInterface.GetIPStatistics()` and `netstat -e` counters to calculate exact real-time Download (`Mbps`) and Upload (`Mbps`) rates.
  - Reads live wireless link state from `netsh wlan show interfaces` (Connected SSID, AP BSSID, Band, Channel, Radio type, WPA2/WPA3 cipher, Signal %, RSSI dBm, and PHY link speed).
  - Parses `ipconfig /all` for all hardware network adapters, IPv4/Subnet, Link-local IPv6, MAC address, DHCP server, Default Gateway, and DNS servers.
  - Measures real ICMP ping and jitter (`ping.exe`) to your local gateway and `1.1.1.1`, and resolves your Public WAN IP via Cloudflare trace.
- **Persistent Local Data Usage Store (`%APPDATA%\NetX\netx-usage-store.json`)**:
  - Tracks real downloaded and uploaded bytes on your PC across Hourly (`Day`), Daily (`Week`), and Monthly (`Month`) buckets.
- **Real Internet Speed Test (`netx:run-speed-test`)**:
  - Benchmarks real latency/jitter, real HTTPS download throughput (`speed.cloudflare.com/__down`), and real HTTPS upload throughput (`speed.cloudflare.com/__up`) with live progress streaming.
- **Real Active Processes & Sockets (`netx:get-connections-and-apps`)**:
  - Maps live Windows `netstat -ano` TCP/UDP sockets to running processes from `tasklist /FO CSV` with reverse-DNS hostname resolution.
- **Real Wi-Fi Spectrum & LAN ARP Scanners**:
  - Scans visible wireless BSSIDs (`netsh wlan show networks mode=bssid`) and discovers active unicast devices on your local subnet (`arp -a` + ICMP subnet sweep).
- **Real Interactive Network Tools & Guided Diagnostics**:
  - Executes real `ping.exe`, `tracert.exe`, Node `dns.promises` (`A`, `AAAA`, `MX`, `NS`, `TXT`), and live `net.Socket` TCP port handshakes.

---

## ⚡ Live Development (Hot Reloading & Auto-Restart)

Run NetX in live development mode with instant Hot Module Replacement (HMR) — zero rebuilds or re-installations needed:

```powershell
# Launch the live development desktop application
npm.cmd run dev

# Or simply double-click the included batch launcher:
.\dev.bat
```

- **Instant UI Updates**: Any code edits in `src/` (React components, design system CSS, views) reflect in the desktop app immediately via Vite HMR without losing state or reloading.
- **Auto-Restarting Backend**: Any edits in `electron/` (`main.cjs`, `preload.cjs`) automatically restart the desktop app window.
- **Developer Shortcuts**: Press `F12` inside the app to toggle Chrome DevTools, or `F5`/`Ctrl+R` to hard reload.

---

## 📦 Building & Launching Standalone `NetX.exe`

```powershell
# Build frontend & package standalone Windows executable
npm.cmd run build
npm.cmd run package:exe

# Executable location:
.\release\NetX-win32-x64\NetX.exe
```
