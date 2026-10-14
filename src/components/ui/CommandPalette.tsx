import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AppWindow,
  ArrowRight,
  BarChart3,
  Cable,
  Check,
  Command,
  Copy,
  Gamepad2,
  Gauge,
  Globe,
  History,
  LayoutDashboard,
  Moon,
  Network,
  Radio,
  Search,
  Settings,
  Shield,
  Stethoscope,
  Sun,
  Wifi,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useNetX } from '../../context/NetXContext';
import { NavSection } from '../../types/netx';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Views' | 'Actions' | 'Tools' | 'Quick Info';
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const {
    setActiveNav,
    networkInfo,
    settings,
    updateSettings,
    monitoringPaused,
    setMonitoringPaused,
    pushToast,
  } = useNetX();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const copyVal = (label: string, text: string) => {
    navigator.clipboard?.writeText(text);
    pushToast(`Copied ${label}: ${text}`, 'info');
    onClose();
  };

  const commands: CommandItem[] = [
    // Navigation Views
    {
      id: 'view-dashboard',
      title: 'Dashboard',
      subtitle: 'Real-time throughput, 4-hop topology, and performance summary',
      category: 'Views',
      icon: <LayoutDashboard size={16} />,
      action: () => {
        setActiveNav('dashboard');
        onClose();
      },
      keywords: ['home', 'overview', 'summary', 'bandwidth', 'speed'],
    },
    {
      id: 'view-speedtest',
      title: 'Speed Test',
      subtitle: 'Measure download/upload speeds and latency to Cloudflare edge',
      category: 'Views',
      icon: <Gauge size={16} />,
      action: () => {
        setActiveNav('speed-test');
        onClose();
      },
      keywords: ['benchmark', 'fast', 'download', 'upload', 'ping'],
    },
    {
      id: 'view-datausage',
      title: 'Data Usage',
      subtitle: 'Inspect daily, weekly, and monthly byte consumption',
      category: 'Views',
      icon: <BarChart3 size={16} />,
      action: () => {
        setActiveNav('data-usage');
        onClose();
      },
      keywords: ['history', 'consumption', 'cap', 'quota', 'bytes'],
    },
    {
      id: 'view-apps',
      title: 'Applications',
      subtitle: 'Active processes and per-process network bandwidth',
      category: 'Views',
      icon: <AppWindow size={16} />,
      action: () => {
        setActiveNav('applications');
        onClose();
      },
      keywords: ['process', 'task', 'bandwidth', 'exe', 'apps'],
    },
    {
      id: 'view-connections',
      title: 'Active Connections',
      subtitle: 'Inspect live TCP/UDP sockets and remote IPs',
      category: 'Views',
      icon: <Cable size={16} />,
      action: () => {
        setActiveNav('connections');
        onClose();
      },
      keywords: ['sockets', 'ports', 'tcp', 'udp', 'endpoints'],
    },
    {
      id: 'view-wifi',
      title: 'Wi-Fi Spectrum',
      subtitle: 'Signal strength (RSSI), channel, band, and nearby access points',
      category: 'Views',
      icon: <Wifi size={16} />,
      action: () => {
        setActiveNav('wifi');
        onClose();
      },
      keywords: ['wireless', 'ssid', 'bssid', 'rssi', 'signals', 'ap'],
    },
    {
      id: 'view-network',
      title: 'Local Network & LAN',
      subtitle: 'Subnet ARP scanner and hardware adapter configurations',
      category: 'Views',
      icon: <Network size={16} />,
      action: () => {
        setActiveNav('network');
        onClose();
      },
      keywords: ['lan', 'arp', 'devices', 'subnet', 'adapters', 'mac'],
    },
    {
      id: 'view-gaming',
      title: 'Gaming & Quality Mode',
      subtitle: 'Continuous latency tracking, jitter, stability score, and session logging',
      category: 'Views',
      icon: <Gamepad2 size={16} />,
      action: () => {
        setActiveNav('gaming');
        onClose();
      },
      keywords: ['game', 'ping', 'jitter', 'stability', 'esports', 'packet loss'],
    },
    {
      id: 'view-tools',
      title: 'Network Tools',
      subtitle: 'Ping, Traceroute, DNS Lookup, and TCP Port Checker',
      category: 'Views',
      icon: <Wrench size={16} />,
      action: () => {
        setActiveNav('tools');
        onClose();
      },
      keywords: ['ping', 'traceroute', 'dns', 'port', 'icmp'],
    },
    {
      id: 'view-diagnostics',
      title: 'Guided Diagnostics',
      subtitle: 'Step-by-step automated network path test and troubleshooting',
      category: 'Views',
      icon: <Stethoscope size={16} />,
      action: () => {
        setActiveNav('diagnostics');
        onClose();
      },
      keywords: ['troubleshoot', 'health', 'fix', 'audit', 'check'],
    },
    {
      id: 'view-history',
      title: 'Incident & Event History',
      subtitle: 'Review disconnects, latency spikes, threshold alerts, and adapter events',
      category: 'Views',
      icon: <History size={16} />,
      action: () => {
        setActiveNav('history');
        onClose();
      },
      keywords: ['log', 'history', 'incidents', 'events', 'disconnects', 'alerts'],
    },
    {
      id: 'view-settings',
      title: 'Settings',
      subtitle: 'Preferences, telemetry limits, appearance, and startup',
      category: 'Views',
      icon: <Settings size={16} />,
      action: () => {
        setActiveNav('settings');
        onClose();
      },
      keywords: ['config', 'theme', 'dark', 'light', 'preferences'],
    },

    // Quick Actions
    {
      id: 'action-toggle-monitoring',
      title: monitoringPaused ? 'Resume Live Monitoring' : 'Pause Live Monitoring',
      subtitle: monitoringPaused ? 'Resume 1s polling interval' : 'Freeze background polling',
      category: 'Actions',
      icon: <Activity size={16} />,
      action: () => {
        setMonitoringPaused((p) => !p);
        pushToast(monitoringPaused ? 'Monitoring resumed.' : 'Monitoring paused.', 'info');
        onClose();
      },
      keywords: ['pause', 'resume', 'stop', 'freeze'],
    },
    {
      id: 'action-toggle-theme',
      title: `Switch Theme to ${settings.appearance === 'dark' ? 'Light' : 'Cosmic Dark'} Mode`,
      subtitle: 'Toggle interface styling preference',
      category: 'Actions',
      icon: settings.appearance === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
      action: () => {
        const next = settings.appearance === 'dark' ? 'light' : 'dark';
        updateSettings({ appearance: next });
        pushToast(`Theme switched to ${next} mode.`, 'info');
        onClose();
      },
      keywords: ['dark', 'light', 'appearance', 'theme', 'violet'],
    },

    // Quick System Info Copy
    {
      id: 'copy-ipv4',
      title: `Copy IPv4 Address: ${networkInfo.ipv4}`,
      subtitle: 'Click to copy local PC IP to clipboard',
      category: 'Quick Info',
      icon: <Copy size={16} />,
      action: () => copyVal('IPv4 Address', networkInfo.ipv4),
      keywords: ['ip', 'ipv4', 'address', 'local'],
    },
    {
      id: 'copy-public-ip',
      title: `Copy Public WAN IP: ${networkInfo.publicIp}`,
      subtitle: 'Click to copy public IP to clipboard',
      category: 'Quick Info',
      icon: <Globe size={16} />,
      action: () => copyVal('Public IP', networkInfo.publicIp),
      keywords: ['public', 'wan', 'external'],
    },
    {
      id: 'copy-gateway',
      title: `Copy Gateway IP: ${networkInfo.gateway}`,
      subtitle: 'Click to copy default router gateway to clipboard',
      category: 'Quick Info',
      icon: <Zap size={16} />,
      action: () => copyVal('Gateway', networkInfo.gateway),
      keywords: ['router', 'gateway', 'default'],
    },
    {
      id: 'copy-mac',
      title: `Copy Hardware MAC: ${networkInfo.mac}`,
      subtitle: 'Physical interface address',
      category: 'Quick Info',
      icon: <Shield size={16} />,
      action: () => copyVal('MAC Address', networkInfo.mac),
      keywords: ['mac', 'hardware', 'nic'],
    },
  ];

  // Filtering
  const cleanQ = query.trim().toLowerCase();
  const filtered = cleanQ
    ? commands.filter(
        (c) =>
          c.title.toLowerCase().includes(cleanQ) ||
          (c.subtitle && c.subtitle.toLowerCase().includes(cleanQ)) ||
          c.category.toLowerCase().includes(cleanQ) ||
          (c.keywords && c.keywords.some((k) => k.toLowerCase().includes(cleanQ)))
      )
    : commands;

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="palette-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="palette-search-row">
          <Search size={18} className="palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Type a command, tool, or action (e.g. speed, ping, wifi, ip)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <button type="button" className="palette-close-btn" onClick={onClose} title="Close (Esc)">
            <kbd className="palette-kbd">Esc</kbd>
          </button>
        </div>

        {/* Results List */}
        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="palette-empty">
              <span>No commands or utilities found matching "{query}"</span>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="palette-item-icon">{item.icon}</div>
                  <div className="palette-item-text">
                    <span className="palette-item-title">{item.title}</span>
                    {item.subtitle && (
                      <span className="palette-item-sub">{item.subtitle}</span>
                    )}
                  </div>
                  <span className="palette-item-cat">{item.category}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Palette Footer Hints */}
        <div className="palette-footer">
          <div className="palette-hint">
            <kbd className="palette-kbd">↑</kbd>
            <kbd className="palette-kbd">↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="palette-hint">
            <kbd className="palette-kbd">↵</kbd>
            <span>Select</span>
          </div>
          <div className="palette-hint">
            <kbd className="palette-kbd">Esc</kbd>
            <span>Dismiss</span>
          </div>
        </div>
      </div>
    </div>
  );
};
