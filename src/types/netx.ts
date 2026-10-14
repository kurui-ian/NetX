export type NavSection =
  | 'dashboard'
  | 'speed-test'
  | 'data-usage'
  | 'applications'
  | 'connections'
  | 'wifi'
  | 'network'
  | 'tools'
  | 'diagnostics'
  | 'settings';

export type AppearanceMode = 'light' | 'dark' | 'system';

export type ResolvedTheme = 'light' | 'dark';

export interface BandwidthPoint {
  timestamp: string;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
}

export interface SpeedTestRecord {
  id: string;
  date: string;
  server: string;
  pingMs: number;
  jitterMs: number;
  downloadMbps: number;
  uploadMbps: number;
  interfaceName: string;
}

export interface AppTrafficItem {
  id: string;
  name: string;
  processName: string;
  pid: number;
  category: string;
  status: 'active' | 'idle' | 'background';
  downloadMbps: number;
  uploadMbps: number;
  todayTotalGb: number;
  monthTotalGb: number;
  connectionsCount: number;
  establishedCount?: number;
  memMb?: number;
}

export interface ActiveConnectionItem {
  id: string;
  appName: string;
  processName: string;
  pid?: number;
  protocol: 'TCP' | 'UDP' | 'QUIC';
  localAddress: string;
  remoteAddress: string;
  remoteIp?: string;
  remoteHost: string;
  state: string;
}

export interface LanDeviceItem {
  id: string;
  name: string;
  ip: string;
  mac: string;
  vendor: string;
  type: 'phone' | 'laptop' | 'tv' | 'console' | 'desktop' | 'router' | 'iot';
  connectionBand: string;
  pingMs: number;
  status: 'online' | 'idle';
  isCurrentDevice?: boolean;
}

export interface WifiNetworkItem {
  id: string;
  ssid: string;
  bssid: string;
  signalDbm: number;
  signalQuality: number;
  band: string;
  channel: string;
  security: string;
  linkSpeedMbps: number;
  connected?: boolean;
}

export interface RealAdapterInfo {
  name: string;
  type: string;
  description: string;
  mac: string;
  status: string;
  ipv4: string;
  subnet: string;
  ipv6: string;
  gateway: string;
  dns: string;
  dhcpEnabled: string;
  dhcpServer: string;
}

export interface RealNetworkInfo {
  hostname: string;
  interfaceName: string;
  adapterDescription: string;
  ssid: string;
  bssid: string;
  connectionType: string;
  band: string;
  channel: string;
  security: string;
  signalQuality: number;
  signalDbm: number;
  linkSpeedMbps: number;
  ipv4: string;
  subnet: string;
  ipv6: string;
  mac: string;
  gateway: string;
  dnsServers: string;
  dhcpServer: string;
  publicIp: string;
  ispEdge: string;
  adapters: RealAdapterInfo[];
}

export interface UsageBucket {
  rxBytes: number;
  txBytes: number;
}

export interface UsageStoreData {
  lastBootAdapterRx: number;
  lastBootAdapterTx: number;
  daily: Record<string, UsageBucket>;
  hourly: Record<string, UsageBucket>;
  monthly: Record<string, UsageBucket>;
  appBytes?: Record<string, any>;
}

export interface NetXSettings {
  appearance: AppearanceMode;
  startWithWindows: boolean;
  startMinimized: boolean;
  notifyConnectionChanges: boolean;
  notifyUsageAlerts: boolean;
  refreshIntervalSec: 1 | 2 | 5;
  historyRetentionDays: 7 | 30 | 90 | 365;
  monthlyCapGb: number;
  preferredInterface: string;
  telemetryLocalOnly: boolean;
}

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'warning';
}

declare global {
  interface Window {
    netxNative?: {
      isNativeApp: boolean;
      getTelemetry: () => Promise<any>;
      getConnectionsAndApps: () => Promise<any>;
      getWifiNetworks: (rescan?: boolean) => Promise<any>;
      getLanDevices: (activeSweep?: boolean) => Promise<any>;
      runSpeedTest: () => Promise<any>;
      onSpeedTestProgress: (cb: (data: any) => void) => () => void;
      runDiagnosticStep: (stepId: string) => Promise<any>;
      runTool: (tool: string, target: string) => Promise<any>;
      setStartupRegistry: (enabled: boolean, minimized: boolean) => Promise<any>;
      clearUsageHistory: () => Promise<any>;
      quitApp: () => Promise<any>;
    };
  }
}
