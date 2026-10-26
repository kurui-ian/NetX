# NetX — Network Engineering & Troubleshooting Guide

## 1. Primary Network Metrics Explained

### A. Latency & Jitter
- **Latency (Ping)**: The round-trip time (RTT) required for an ICMP echo packet to travel from your host adapter to the destination endpoint and return.
  - Sub-25ms: Optimal for competitive gaming, real-time audio, and remote desktop protocols.
  - 25ms - 60ms: Solid broadband standard for 4K streaming and video calls.
  - >150ms: Noticeable delay in interactive applications.
- **Jitter**: The statistical variance in latency across sequential packets.
  $$\text{Jitter} = | \text{RTT}_n - \text{RTT}_{n-1} |$$
  NetX continuously computes jitter every 1,000ms against your configured DNS endpoint. Spikes in jitter typically indicate bufferbloat on intermediate home routers or local Wi-Fi channel contention.

### B. Packet Loss
- Measured by transmitting a bounded burst of ICMP echo requests (4 to 10 packets) and calculating dropped datagrams:
  $$\text{Loss \%} = \frac{\text{Sent} - \text{Received}}{\text{Sent}} \times 100$$
- Even 1% - 2% loss triggers TCP congestion control retransmissions, severely throttling TCP throughput.

---

## 2. 4-Stage Diagnostic Methodology

NetX implements an automated 4-stage health checklist to isolate connectivity faults without requiring manual CLI commands:

```
[1. Hardware Adapter]  --> Valid IPv4 assignment & link up
        ↓
[2. Default Gateway]   --> Local LAN router responds to ICMP echo
        ↓
[3. DNS Resolver]      --> Domain resolution & port 53 query validation
        ↓
[4. WAN Cloud Edge]    --> HTTPS handshake & Anycast route reachability
```

### Isolating Root Causes:
1. **Stage 1 fails**: Unplugged Ethernet cable, disabled Wi-Fi adapter, or DHCP lease failure.
2. **Stage 1 passes, Stage 2 fails**: Computer has valid IP, but local router/switch is unresponsive. Check router power or cable.
3. **Stage 1 & 2 pass, Stage 3 fails**: Local router is online, but configured DNS servers (ISP or custom) are timing out. Use NetX "Flush DNS Cache" or switch to 1.1.1.1 / 8.8.8.8.
4. **Stage 1, 2 & 3 pass, Stage 4 fails**: Upstream ISP outage or WAN transit link failure.

---

## 3. Cloudflare Edge Benchmarking Mechanics

NetX's Speed Test engine executes a multi-stream benchmark directly against Cloudflare's Anycast Edge CDN:
1. **Phase 1: Endpoint Discovery**: Negotiates nearest edge point-of-presence (PoP).
2. **Phase 2: Unloaded Latency & Jitter**: Measures baseline idle latency.
3. **Phase 3: Multi-Stream Download**: Transfers chunked binary payloads (25MB to 80MB) across concurrent HTTP/2 streams to saturate available downstream capacity.
4. **Phase 4: Multi-Stream Upload**: Posts chunked payloads to evaluate upstream throughput.
5. **Phase 5: Real Synthesis**: Results are rendered into live charts and persisted to the local audit log.
