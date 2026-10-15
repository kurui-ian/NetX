const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('netxNative', {
  isNativeApp: true,
  getTelemetry: () => ipcRenderer.invoke('netx:get-telemetry'),
  getConnectionsAndApps: () => ipcRenderer.invoke('netx:get-connections-and-apps'),
  getWifiNetworks: (rescan = false) => ipcRenderer.invoke('netx:scan-wifi', rescan),
  getLanDevices: (activeSweep = false) => ipcRenderer.invoke('netx:scan-lan', activeSweep),
  runSpeedTest: (options) => ipcRenderer.invoke('netx:run-speed-test', options),
  cancelSpeedTest: () => ipcRenderer.invoke('netx:cancel-speed-test'),
  onSpeedTestProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('netx:speed-test-progress', listener);
    return () => ipcRenderer.removeListener('netx:speed-test-progress', listener);
  },
  runDiagnosticStep: (stepId) => ipcRenderer.invoke('netx:run-diagnostic-step', stepId),
  runTool: (tool, target, options) => ipcRenderer.invoke('netx:run-tool', { tool, target, options }),
  exportDiagnosticReport: (reportData, format) =>
    ipcRenderer.invoke('netx:export-diagnostic-report', { reportData, format }),
  setStartupRegistry: (enabled, minimized) =>
    ipcRenderer.invoke('netx:set-startup', { enabled, minimized }),
  toggleMiniMode: (enableMini) => ipcRenderer.invoke('netx:toggle-mini-mode', enableMini),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('netx:set-always-on-top', flag),
  clearUsageHistory: () => ipcRenderer.invoke('netx:clear-usage-history'),
  flushDns: () => ipcRenderer.invoke('netx:flush-dns'),
  renewDhcp: () => ipcRenderer.invoke('netx:renew-dhcp'),
  disconnectWifi: () => ipcRenderer.invoke('netx:disconnect-wifi'),
  connectWifi: (ssid, password) => ipcRenderer.invoke('netx:connect-wifi', { ssid, password }),
  getOllamaStatus: (url) => ipcRenderer.invoke('netx:ollama-status', { url }),
  chatOllama: (payload) => ipcRenderer.invoke('netx:ollama-chat', payload),
  quitApp: () => ipcRenderer.invoke('netx:quit-app'),
});
