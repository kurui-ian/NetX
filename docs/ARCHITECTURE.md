# NetX — System Architecture & Engineering Specification

## 1. Overview & High-Level Topology

NetX is engineered as a high-performance desktop network operations utility and real-time telemetry suite for 64-bit Windows environments. It bridges raw hardware network counters from the Windows operating system into a high-contrast dark technical interface designed according to the Taste Skill Data Terminal art direction.

```mermaid
graph TD
    subgraph Host OS ["Windows 10 / 11 Host OS"]
        WLAN["Native WLAN API (wlanapi.dll)"]
        DNS["Windows DNS Client (Clear-DnsClientCache)"]
        IPHLP["IP Helper API & Netsh"]
        ICMP["ICMP Ping & Trace Engine"]
    end

    subgraph Native Engine ["Electron 33 Main Process (Node.js 24)"]
        IPC["IPC Service Handlers (ipcMain)"]
        TEL["Telemetry Poller (1s Ticker)"]
        USAGE["Persistent Usage Store (disk JSON)"]
        WIFI_SCAN["Active Hardware Wi-Fi Scanner (wlanscan.exe)"]
    end

    subgraph Sandbox Bridge ["Isolated Preload Context"]
        PRELOAD["contextBridge (window.netxNative)"]
    end

    subgraph Presentation Layer ["React 18 + Vite 6 UI"]
        CTX["NetXContext (State & History)"]
        VIEWS["Core Suite Views (Overview, Speed Test, Diagnostics, Wi-Fi...)"]
        AI["AI Operations Assistant (Gemini / Ollama / Native)"]
    end

    WLAN --> IPC
    DNS --> IPC
    IPHLP --> TEL
    ICMP --> TEL
    IPC --> PRELOAD
    TEL --> USAGE
    WIFI_SCAN --> IPC
    PRELOAD --> CTX
    CTX --> VIEWS
    CTX --> AI
```

---

## 2. Layered Architecture

### Layer 1: Native Windows Telemetry & Hardware Engine
- **Hardware Interface Polling**: Queries interface adapter byte counters delta (`rawRxBytes`, `rawTxBytes`) every 1,000ms. Discards single-second anomalies (>1 GB/s) to maintain telemetry integrity.
- **Active Wi-Fi Scanning**: Invokes Win32 `WlanScan` directly via `bin/wlanscan.exe` or PowerShell fallback to command the wireless NIC driver to broadcast probe requests on 2.4 GHz and 5 GHz channels.
- **Dual-Stage Gateway & DNS Probing**: Measures ICMP round-trip latency to the local default gateway and external DNS (`1.1.1.1` with `8.8.8.8` fallback) to distinguish local router disconnects from upstream WAN routing failures.
- **Non-Elevated DNS Resolver Flush**: Utilizes PowerShell's `Clear-DnsClientCache` cmdlet, enabling full DNS cache flushing without prompting for UAC administrator privileges.

### Layer 2: Preload Security Boundary
- Context isolation enabled (`contextIsolation: true`, `nodeIntegration: false`).
- All native capabilities exposed exclusively through typed `window.netxNative` APIs.
- No direct filesystem access or unverified shell execution permitted from the renderer process.

### Layer 3: Presentation & Taste-Skill UI
- **Design Tokens**: Charcoal base (`#0a0d12`), elevated card surfaces (`#11161d`, `#161c24`), electric cyan primary accents (`#0284c7`, `#0ea5e9`, `#38bdf8`), restrained emerald green for healthy states, amber warnings, and red failure alerts.
- **Typography & Precision**: High-contrast tabular numbers, 1px rules, no excessive glow or glassmorphism slop.
- **Dual Theme Support**: Dark-first technical mode with high-contrast slate light mode.

### Layer 4: AI Operations Bridge
- **Google Gemini Flash Lite**: Sub-second cloud reasoning with tool calling (`run_speed_test`, `list_wifi_networks`, `connect_wifi`, `ping_host`, `flush_dns`, etc.).
- **Local Ollama Integration**: Offline neural engine support (`llama3.2`, `mistral`, `qwen2.5-coder`).
- **Deterministic Native Fallback**: Zero-cloud offline regex intent engine ensuring basic operational queries work even during total internet blackouts.
