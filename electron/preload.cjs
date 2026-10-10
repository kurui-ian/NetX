const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('netxNative', {
  isNativeApp: true,
  getTelemetry: () => ipcRenderer.invoke('netx:get-telemetry'),
  getConnectionsAndApps: () => ipcRenderer.invoke('netx:get-connections-and-apps'),
  getWifiNetworks: (rescan = false) => ipcRenderer.invoke('netx:scan-wifi', rescan),
  getLanDevices: (activeSweep = false) => ipcRenderer.invoke('netx:scan-lan', activeSweep),
  runSpeedTest: () => ipcRenderer.invoke('netx:run-speed-test'),
  onSpeedTestProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('netx:speed-test-progress', listener);
    return () => ipcRenderer.removeListener('netx:speed-test-progress', listener);
  },
  runDiagnosticStep: (stepId) => ipcRenderer.invoke('netx:run-diagnostic-step', stepId),
  runTool: (tool, target) => ipcRenderer.invoke('netx:run-tool', { tool, target }),
  setStartupRegistry: (enabled, minimized) =>
    ipcRenderer.invoke('netx:set-startup', { enabled, minimized }),
  clearUsageHistory: () => ipcRenderer.invoke('netx:clear-usage-history'),
  quitApp: () => ipcRenderer.invoke('netx:quit-app'),
});
