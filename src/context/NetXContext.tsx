import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  ActiveConnectionItem,
  AppearanceMode,
  AppTrafficItem,
  BandwidthPoint,
  LanDeviceItem,
  NavSection,
  NetXSettings,
  NetworkEventItem,
  RealNetworkInfo,
  ResolvedTheme,
  SpeedTestRecord,
  ToastMessage,
  UsageStoreData,
  WifiNetworkItem,
} from '../types/netx';
import { DEFAULT_GEMINI_API_KEY, DEFAULT_GEMINI_MODEL } from '../services/geminiClient';

const DEFAULT_SETTINGS: NetXSettings = {
  appearance: 'dark',
  startWithWindows: false,
  startMinimized: false,
  notifyConnectionChanges: true,
  notifyUsageAlerts: true,
  refreshIntervalSec: 1,
  historyRetentionDays: 30,
  monthlyCapGb: 500,
  preferredInterface: 'Primary Active Interface',
  telemetryLocalOnly: true,
  aiProvider: 'gemini',
  geminiApiKey: DEFAULT_GEMINI_API_KEY,
  geminiModel: DEFAULT_GEMINI_MODEL,
  ollamaUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'llama3.2',
  aiTemperature: 0.4,
  aiConfirmActions: true,
  customUserName: '',
};

const EMPTY_NETWORK_INFO: RealNetworkInfo = {
  hostname: 'Loading...',
  interfaceName: 'Wi-Fi',
  adapterDescription: 'Detecting network adapter...',
  ssid: 'Detecting...',
  bssid: '—',
  connectionType: 'Detecting...',
  band: '—',
  channel: '—',
  security: '—',
  signalQuality: 0,
  signalDbm: -60,
  linkSpeedMbps: 0,
  ipv4: '—',
  subnet: '—',
  ipv6: '—',
  mac: '—',
  gateway: '—',
  dnsServers: '—',
  dhcpServer: '—',
  publicIp: 'Detecting...',
  ispEdge: '',
  adapters: [],
};

interface NetXContextValue {
  activeNav: NavSection;
  setActiveNav: (nav: NavSection) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  settings: NetXSettings;
  updateSettings: (partial: Partial<NetXSettings>) => void;
  resolvedTheme: ResolvedTheme;
  monitoringPaused: boolean;
  setMonitoringPaused: React.Dispatch<React.SetStateAction<boolean>>;
  connected: boolean;
  internetReachable: boolean;
  networkInfo: RealNetworkInfo;
  bandwidthHistory: BandwidthPoint[];
  currentDownloadMbps: number;
  currentUploadMbps: number;
  currentPingMs: number;
  currentJitterMs: number;
  gatewayPingMs: number;
  dnsPingMs: number;
  todayUsageGb: number;
  todayDownloadGb: number;
  todayUploadGb: number;
  monthUsageGb: number;
  monthDownloadGb: number;
  monthUploadGb: number;
  usageStore: UsageStoreData | null;
  clearUsageHistory: () => Promise<void>;
  speedTestHistory: SpeedTestRecord[];
  addSpeedTestRecord: (record: Omit<SpeedTestRecord, 'id' | 'date'>) => void;
  clearSpeedTestHistory: () => void;
  apps: AppTrafficItem[];
  connections: ActiveConnectionItem[];
  lanDevices: LanDeviceItem[];
  wifiNetworks: WifiNetworkItem[];
  refreshWifi: () => Promise<void>;
  refreshLan: (activeSweep?: boolean) => Promise<void>;
  refreshConnectionsAndApps: () => Promise<void>;
  toasts: ToastMessage[];
  pushToast: (text: string, type?: ToastMessage['type']) => void;
  networkEvents: NetworkEventItem[];
  addNetworkEvent: (evt: Omit<NetworkEventItem, 'id' | 'timestamp'>) => void;
  clearNetworkEvents: () => void;
}

const NetXContext = createContext<NetXContextValue | null>(null);

export const NetXProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [monitoringPaused, setMonitoringPaused] = useState<boolean>(false);

  // Settings & Persistent Appearance (Section 4 & 20)
  const [settings, setSettings] = useState<NetXSettings>(() => {
    try {
      const savedSettings = localStorage.getItem('netx-settings-v2');
      const savedTheme = localStorage.getItem('netx-theme') as AppearanceMode | null;
      const parsed = savedSettings ? JSON.parse(savedSettings) : {};
      const geminiApiKey =
        parsed.geminiApiKey && parsed.geminiApiKey.trim()
          ? parsed.geminiApiKey.trim()
          : DEFAULT_SETTINGS.geminiApiKey;
      const geminiModel =
        parsed.geminiModel &&
        parsed.geminiModel !== 'gemini-1.5-flash' &&
        parsed.geminiModel !== 'gemini-2.0-flash'
          ? parsed.geminiModel
          : DEFAULT_SETTINGS.geminiModel;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        geminiApiKey,
        geminiModel,
        appearance: savedTheme || parsed.appearance || 'dark',
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme: ResolvedTheme =
    settings.appearance === 'system'
      ? systemPrefersDark
        ? 'dark'
        : 'light'
      : settings.appearance;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-theme-preference', settings.appearance);
    const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    if (meta) {
      meta.content = settings.appearance === 'system' ? 'light dark' : settings.appearance;
    }
    try {
      localStorage.setItem('netx-theme', settings.appearance);
      localStorage.setItem('netx-settings-v2', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings, resolvedTheme]);

  const updateSettings = useCallback((partial: Partial<NetXSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (
        window.netxNative &&
        ('startWithWindows' in partial || 'startMinimized' in partial)
      ) {
        window.netxNative.setStartupRegistry(next.startWithWindows, next.startMinimized);
      }
      return next;
    });
  }, []);

  // Real System & Network State
  const [connected, setConnected] = useState<boolean>(true);
  const [internetReachable, setInternetReachable] = useState<boolean>(true);
  const [networkInfo, setNetworkInfo] = useState<RealNetworkInfo>(EMPTY_NETWORK_INFO);
  const [bandwidthHistory, setBandwidthHistory] = useState<BandwidthPoint[]>([]);
  const [currentDownloadMbps, setCurrentDownloadMbps] = useState<number>(0);
  const [currentUploadMbps, setCurrentUploadMbps] = useState<number>(0);
  const [currentPingMs, setCurrentPingMs] = useState<number>(0);
  const [currentJitterMs, setCurrentJitterMs] = useState<number>(0);
  const [gatewayPingMs, setGatewayPingMs] = useState<number>(0);
  const [dnsPingMs, setDnsPingMs] = useState<number>(0);

  const [todayUsageGb, setTodayUsageGb] = useState<number>(0);
  const [todayDownloadGb, setTodayDownloadGb] = useState<number>(0);
  const [todayUploadGb, setTodayUploadGb] = useState<number>(0);
  const [monthUsageGb, setMonthUsageGb] = useState<number>(0);
  const [monthDownloadGb, setMonthDownloadGb] = useState<number>(0);
  const [monthUploadGb, setMonthUploadGb] = useState<number>(0);
  const [usageStore, setUsageStore] = useState<UsageStoreData | null>(null);

  const [rawApps, setRawApps] = useState<any[]>([]);
  const [connections, setConnections] = useState<ActiveConnectionItem[]>([]);
  const [lanDevices, setLanDevices] = useState<LanDeviceItem[]>([]);
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetworkItem[]>([]);

  // Speed Test History (Only real user tests stored in localStorage)
  const [speedTestHistory, setSpeedTestHistory] = useState<SpeedTestRecord[]>(() => {
    try {
      const saved = localStorage.getItem('netx-real-speedtests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('netx-real-speedtests', JSON.stringify(speedTestHistory));
    } catch {
      // ignore
    }
  }, [speedTestHistory]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // Network Event History (Section 14)
  const [networkEvents, setNetworkEvents] = useState<NetworkEventItem[]>(() => {
    try {
      const saved = localStorage.getItem('netx-network-events-v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: `evt-init`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'info',
        severity: 'info',
        title: 'Network Telemetry Initialized',
        description: 'NetX started live monitoring on primary network interface.',
        evidence: 'Operating system counters and ping probes active.',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('netx-network-events-v1', JSON.stringify(networkEvents.slice(0, 100)));
    } catch {}
  }, [networkEvents]);

  const addNetworkEvent = useCallback((evt: Omit<NetworkEventItem, 'id' | 'timestamp'>) => {
    const newEntry: NetworkEventItem = {
      ...evt,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setNetworkEvents((prev) => [newEntry, ...prev.slice(0, 99)]);
  }, []);

  const clearNetworkEvents = useCallback(() => {
    setNetworkEvents([]);
    pushToast('Network event history cleared.', 'info');
  }, [pushToast]);

  const lastConnectedRef = useRef<boolean | null>(null);
  const lastLatencySpikeRef = useRef<number>(0);
  const lastThresholdAlertRef = useRef<number>(0);

  // Poll Real OS Telemetry
  const pollTelemetry = useCallback(async () => {
    if (!window.netxNative) return;
    try {
      const data = await window.netxNative.getTelemetry();
      if (!data) return;

      const isConn = Boolean(data.connected);
      const isNet = Boolean(data.internetReachable);

      // Event detection: connection drop or restoration
      if (lastConnectedRef.current !== null) {
        if (lastConnectedRef.current && !isNet) {
          addNetworkEvent({
            type: 'disconnect',
            severity: 'danger',
            title: 'Internet Connection Lost',
            description: 'Unable to reach external DNS or gateway.',
            evidence: `Ping to 1.1.1.1 failed. Adapter: ${data.network?.interfaceName || 'Active'}`,
          });
          if (settings.notifyConnectionChanges) {
            pushToast('Internet connection dropped.', 'warning');
          }
        } else if (!lastConnectedRef.current && isNet) {
          addNetworkEvent({
            type: 'reconnect',
            severity: 'info',
            title: 'Internet Connection Restored',
            description: `Internet reachability recovered on ${data.network?.interfaceName || 'interface'}.`,
            evidence: `Gateway ${data.network?.gateway} reachable. Latency: ${data.pingMs} ms`,
          });
          if (settings.notifyConnectionChanges) {
            pushToast('Internet connection restored.', 'success');
          }
        }
      }
      lastConnectedRef.current = isNet;

      // Event detection: Latency spike (> 180ms) with 60s cooldown
      const nowTs = Date.now();
      if (data.pingMs > 180 && nowTs - lastLatencySpikeRef.current > 60000) {
        lastLatencySpikeRef.current = nowTs;
        addNetworkEvent({
          type: 'latency_spike',
          severity: 'warning',
          title: `High Latency Detected (${data.pingMs} ms)`,
          description: `Network round-trip latency exceeded normal threshold of 180ms.`,
          evidence: `DNS: ${data.dnsPingMs} ms · Gateway: ${data.gatewayPingMs} ms · Jitter: ${data.jitterMs} ms`,
        });
      }

      // Event detection: Monthly data usage threshold alert (90% of cap)
      const capGb = settings.monthlyCapGb || 500;
      if (settings.notifyUsageAlerts && data.monthTotalGb >= capGb * 0.9 && nowTs - lastThresholdAlertRef.current > 86400000) {
        lastThresholdAlertRef.current = nowTs;
        addNetworkEvent({
          type: 'threshold',
          severity: 'warning',
          title: 'Data Allowance 90% Threshold Exceeded',
          description: `Current month usage has reached ${(data.monthTotalGb).toFixed(1)} GB of your ${capGb} GB cap.`,
          evidence: `Daily average consumption: ${(data.monthTotalGb / Math.max(1, new Date().getDate())).toFixed(2)} GB/day`,
        });
        pushToast(`Warning: Data usage reached 90% of monthly ${capGb} GB allowance.`, 'warning');
      }

      setConnected(isConn);
      setInternetReachable(isNet);
      setCurrentDownloadMbps(data.downloadMbps || 0);
      setCurrentUploadMbps(data.uploadMbps || 0);
      setCurrentPingMs(data.pingMs || 0);
      setCurrentJitterMs(data.jitterMs || 0);
      setGatewayPingMs(data.gatewayPingMs || 1);
      setDnsPingMs(data.dnsPingMs || 0);

      setTodayDownloadGb(data.todayDownloadGb || 0);
      setTodayUploadGb(data.todayUploadGb || 0);
      setTodayUsageGb(data.todayTotalGb || 0);
      setMonthDownloadGb(data.monthDownloadGb || 0);
      setMonthUploadGb(data.monthUploadGb || 0);
      setMonthUsageGb(data.monthTotalGb || 0);

      if (data.usageStore) {
        setUsageStore(data.usageStore);
      }

      if (data.network) {
        setNetworkInfo(data.network);
      }

      setBandwidthHistory((prev) => {
        const pt: BandwidthPoint = {
          timestamp: data.timestamp,
          downloadMbps: data.downloadMbps || 0,
          uploadMbps: data.uploadMbps || 0,
          pingMs: data.pingMs || 0,
        };
        const next = [...prev, pt];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });
    } catch {
      // ignore transient error
    }
  }, [addNetworkEvent, pushToast, settings.notifyConnectionChanges, settings.notifyUsageAlerts, settings.monthlyCapGb]);

  const refreshConnectionsAndApps = useCallback(async () => {
    if (!window.netxNative) return;
    try {
      const res = await window.netxNative.getConnectionsAndApps();
      if (res?.connections) setConnections(res.connections);
      if (res?.apps) setRawApps(res.apps);
    } catch {
      // ignore
    }
  }, []);

  const refreshWifi = useCallback(async () => {
    if (!window.netxNative) return;
    try {
      const res = await window.netxNative.getWifiNetworks(true);
      if (res?.networks) setWifiNetworks(res.networks);
    } catch {
      // ignore
    }
  }, []);

  const refreshLan = useCallback(async (activeSweep = false) => {
    if (!window.netxNative) return;
    try {
      const res = await window.netxNative.getLanDevices(activeSweep);
      if (res?.devices) setLanDevices(res.devices);
    } catch {
      // ignore
    }
  }, []);

  // Initial Load of All Real OS Data
  useEffect(() => {
    pollTelemetry();
    refreshConnectionsAndApps();
    refreshWifi();
    refreshLan(false);
  }, [pollTelemetry, refreshConnectionsAndApps, refreshWifi, refreshLan]);

  // Periodic Telemetry Ticker
  useEffect(() => {
    if (monitoringPaused) return;
    const ms = Math.max(1000, settings.refreshIntervalSec * 1000);
    const timer = setInterval(pollTelemetry, ms);
    return () => clearInterval(timer);
  }, [monitoringPaused, settings.refreshIntervalSec, pollTelemetry]);

  // Periodic Process/Socket Refresh
  useEffect(() => {
    if (monitoringPaused) return;
    const timer = setInterval(refreshConnectionsAndApps, 4000);
    return () => clearInterval(timer);
  }, [monitoringPaused, refreshConnectionsAndApps]);

  // Compute per-application live bandwidth & usage attribution based on active sockets
  const totalEstablished = Math.max(
    1,
    rawApps.reduce((acc, a) => acc + (a.establishedCount || 0), 0)
  );
  const totalSocketsAll = Math.max(
    1,
    rawApps.reduce((acc, a) => acc + (a.connectionsCount || 0), 0)
  );

  const apps: AppTrafficItem[] = rawApps.map((a) => {
    const activeShare = (a.establishedCount || 0) / totalEstablished;
    const socketShare = (a.connectionsCount || 0) / totalSocketsAll;
    const dl =
      a.establishedCount > 0
        ? Math.round(currentDownloadMbps * activeShare * 100) / 100
        : 0;
    const ul =
      a.establishedCount > 0
        ? Math.round(currentUploadMbps * activeShare * 100) / 100
        : 0;
    return {
      id: a.id,
      name: a.name,
      processName: a.processName,
      pid: a.pid,
      category: a.category,
      status: a.status,
      downloadMbps: dl,
      uploadMbps: ul,
      todayTotalGb: Math.round(todayUsageGb * socketShare * 1000) / 1000,
      monthTotalGb: Math.round(monthUsageGb * socketShare * 1000) / 1000,
      connectionsCount: a.connectionsCount,
      establishedCount: a.establishedCount,
      memMb: a.memMb,
    };
  });

  const addSpeedTestRecord = useCallback(
    (record: Omit<SpeedTestRecord, 'id' | 'date'>) => {
      const nowStr = new Date().toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const newEntry: SpeedTestRecord = {
        ...record,
        id: `st-${Date.now()}`,
        date: nowStr,
      };
      setSpeedTestHistory((prev) => [newEntry, ...prev]);
    },
    []
  );

  const clearSpeedTestHistory = useCallback(() => {
    setSpeedTestHistory([]);
    pushToast('Speed test history cleared.', 'info');
  }, [pushToast]);

  const clearUsageHistory = useCallback(async () => {
    if (window.netxNative?.clearUsageHistory) {
      await window.netxNative.clearUsageHistory();
    }
    setUsageStore({
      lastBootAdapterRx: 0,
      lastBootAdapterTx: 0,
      daily: {},
      hourly: {},
      monthly: {},
      appBytes: {},
    });
    setTodayDownloadGb(0);
    setTodayUploadGb(0);
    setTodayUsageGb(0);
    setMonthDownloadGb(0);
    setMonthUploadGb(0);
    setMonthUsageGb(0);
    pushToast('Data usage counters have been recalibrated to zero.', 'success');
  }, [pushToast]);

  return (
    <NetXContext.Provider
      value={{
        activeNav,
        setActiveNav,
        sidebarCollapsed,
        setSidebarCollapsed,
        settings,
        updateSettings,
        resolvedTheme,
        monitoringPaused,
        setMonitoringPaused,
        connected,
        internetReachable,
        networkInfo,
        bandwidthHistory,
        currentDownloadMbps,
        currentUploadMbps,
        currentPingMs,
        currentJitterMs,
        gatewayPingMs,
        dnsPingMs,
        todayUsageGb,
        todayDownloadGb,
        todayUploadGb,
        monthUsageGb,
        monthDownloadGb,
        monthUploadGb,
        usageStore,
        clearUsageHistory,
        speedTestHistory,
        addSpeedTestRecord,
        clearSpeedTestHistory,
        apps,
        connections,
        lanDevices,
        wifiNetworks,
        refreshWifi,
        refreshLan,
        refreshConnectionsAndApps,
        toasts,
        pushToast,
        networkEvents,
        addNetworkEvent,
        clearNetworkEvents,
      }}
    >
      {children}
    </NetXContext.Provider>
  );
};

export const useNetX = (): NetXContextValue => {
  const ctx = useContext(NetXContext);
  if (!ctx) {
    throw new Error('useNetX must be used within a NetXProvider');
  }
  return ctx;
};
