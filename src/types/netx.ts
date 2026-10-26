export type DiagnosticSeverity = 'info' | 'warning' | 'danger';

export type ToolCategory = 'diagnostic' | 'repair' | 'telemetry' | 'discovery';

/**
 * Top-level navigation sections within NetX Core Suite and Utilities
 */
export type NavSection =
  | 'dashboard'
  | 'ai-assistant'
  | 'speed-test'
  | 'data-usage'
  | 'applications'
  | 'connections'
  | 'wifi'
  | 'network'
  | 'gaming'
  | 'tools'
  | 'diagnostics'
  | 'history'
  | 'settings';

/**
 * Persistent network event or anomaly recorded in the audit log
 */
export interface NetworkEventItem {
  id: string;
  timestamp: string;
  type: 'disconnect' | 'reconnect' | 'latency_spike' | 'packet_loss' | 'threshold' | 'adapter_change' | 'info';
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  evidence?: string;
}

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
  packetLossPct?: number;
  minPingMs?: number;
  maxPingMs?: number;
  downloadMbps: number;
  uploadMbps: number;
  interfaceName: string;
  durationSec?: number;
  status?: 'complete' | 'aborted' | 'error';
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

export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  modifiedAt?: string;
  family?: string;
  parameterSize?: string;
  format?: string;
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
  // NetX AI Configuration
  aiProvider: 'gemini' | 'ollama' | 'offline';
  geminiApiKey: string;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  aiTemperature: number;
  aiConfirmActions: boolean;
  customUserName: string;
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
      runSpeedTest: (options?: { server?: string }) => Promise<any>;
      cancelSpeedTest: () => Promise<any>;
      onSpeedTestProgress: (cb: (data: any) => void) => () => void;
      runDiagnosticStep: (stepId: string) => Promise<any>;
      runTool: (tool: string, target?: string, options?: any) => Promise<any>;
      exportDiagnosticReport: (reportData: any, format?: 'json' | 'txt') => Promise<{ ok: boolean; filePath?: string; cancelled?: boolean; error?: string }>;
      toggleMiniMode: (enableMini: boolean) => Promise<{ ok: boolean; mini?: boolean }>;
      setAlwaysOnTop: (flag: boolean) => Promise<{ ok: boolean; isAlwaysOnTop?: boolean }>;
      setStartupRegistry: (enabled: boolean, minimized: boolean) => Promise<any>;
      clearUsageHistory: () => Promise<any>;
      flushDns: () => Promise<{ ok: boolean; output?: string; error?: string }>;
      renewDhcp: () => Promise<{ ok: boolean; output?: string; error?: string }>;
      disconnectWifi: () => Promise<{ ok: boolean; output?: string; error?: string }>;
      connectWifi: (ssid: string, password?: string) => Promise<{ ok: boolean; connected: boolean; ssid: string; output?: string; interfaceInfo?: any; error?: string }>;
      getOllamaStatus: (url?: string) => Promise<{ ok: boolean; online: boolean; version?: string; url?: string; models: OllamaModelInfo[]; error?: string }>;
      chatOllama: (payload: { url?: string; model: string; messages: any[]; tools?: any[]; options?: any }) => Promise<{ ok: boolean; message?: any; done?: boolean; totalDuration?: number; evalCount?: number; error?: string }>;
      chatGemini: (payload: { apiKey: string; model?: string; payload: any }) => Promise<{ ok: boolean; data?: any; error?: string }>;
      getSystemUser: () => Promise<{ username: string; hostname: string }>;
      quitApp: () => Promise<any>;
    };
  }
}
