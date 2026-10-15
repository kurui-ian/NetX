import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Flame,
  Gauge,
  HelpCircle,
  Info,
  Lock,
  Network,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
  Wifi,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { OllamaModelInfo } from '../types/netx';
import {
  checkOllamaConnection,
  RECOMMENDED_MODELS,
  sendOllamaChat,
  ChatMessage,
  extractFallbackJsonToolCall,
  NETX_AI_SYSTEM_PROMPT,
} from '../services/ollamaClient';
import {
  NETX_AI_TOOLS,
  findToolByName,
  ToolDefinition,
} from '../services/aiToolRegistry';
import { matchUserIntent } from '../services/intentMatcher';
import {
  analyzeDiagnosticResults,
  DiagnosticAnalysis,
} from '../services/diagnosticAnalyzer';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolExecution?: {
    toolName: string;
    displayName: string;
    status: 'running' | 'confirming' | 'completed' | 'failed' | 'cancelled';
    args: any;
    result?: any;
    error?: string;
    analysis?: DiagnosticAnalysis;
  };
  requiresPassword?: {
    ssid: string;
    submitted?: boolean;
  };
  suggestedActions?: Array<{
    toolName: string;
    label: string;
    args?: any;
    description?: string;
  }>;
  isNativeFallback?: boolean;
}

const QUICK_PROMPTS = [
  { label: '⚡ Speed Test', query: 'Run an internet speed test' },
  { label: '🩺 Diagnose Network', query: 'Why is my internet slow? Diagnose my connection' },
  { label: '🌐 Check DNS', query: 'Check if my DNS is working for cloudflare.com' },
  { label: '📶 Available Wi-Fi', query: 'Show all available Wi-Fi networks' },
  { label: '🖥️ Scan LAN Devices', query: 'Find devices on my local network' },
  { label: '🧹 Flush DNS Cache', query: 'Flush my DNS resolver cache' },
  { label: '📊 Network Summary', query: 'Summarize my network performance and data usage' },
];

export const AiAssistantView: React.FC = () => {
  const {
    settings,
    updateSettings,
    pushToast,
    networkInfo,
    currentDownloadMbps,
    currentUploadMbps,
    currentPingMs,
    currentJitterMs,
    todayUsageGb,
    monthUsageGb,
    speedTestHistory,
    addSpeedTestRecord,
    addNetworkEvent,
    setActiveNav,
  } = useNetX();

  const [messages, setMessages] = useState<UIMessage[]>(() => {
    try {
      const stored = localStorage.getItem('netx-ai-messages-v1');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: `👋 Hello! I am **NetX AI**, your private local network operations assistant.

I can run real speed tests, diagnose connectivity problems, trace network routes, inspect active connections, scan Wi-Fi, and perform safe network repairs.

I run locally via **Ollama** on your PC—no cloud API keys or telemetry required. How can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [runningActionStatus, setRunningActionStatus] = useState<string | null>(null);

  // Ollama connection & model state
  const [ollamaStatus, setOllamaStatus] = useState<{
    online: boolean;
    version?: string;
    models: OllamaModelInfo[];
    error?: string;
  }>({ online: false, models: [] });
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [wifiPasswordInputs, setWifiPasswordInputs] = useState<Record<string, string>>({});
  const [showWifiPassword, setShowWifiPassword] = useState<Record<string, boolean>>({});

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save messages to local storage
  useEffect(() => {
    try {
      localStorage.setItem('netx-ai-messages-v1', JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, runningActionStatus, isProcessing]);

  // Check Ollama status on mount and when settings URL changes
  const refreshOllama = async () => {
    setIsCheckingOllama(true);
    try {
      const res = await checkOllamaConnection(settings.ollamaUrl);
      setOllamaStatus(res);
      // Auto-select first available model if current setting isn't installed
      if (res.online && res.models.length > 0) {
        const hasCurrent = res.models.some(
          (m) => m.name === settings.ollamaModel || m.model === settings.ollamaModel
        );
        if (!hasCurrent) {
          updateSettings({ ollamaModel: res.models[0].name });
        }
      }
    } catch (err: any) {
      setOllamaStatus({ online: false, models: [], error: err?.message || 'Connection failed' });
    } finally {
      setIsCheckingOllama(false);
    }
  };

  useEffect(() => {
    refreshOllama();
  }, [settings.ollamaUrl]);

  // Execute a Tool Safely and return structured results
  const executeToolSafely = async (
    toolDef: ToolDefinition,
    cleanArgs: any,
    messageId: string
  ): Promise<any> => {
    setRunningActionStatus(`Executing ${toolDef.displayName}...`);

    try {
      let result: any = null;

      if (toolDef.name === 'run_speed_test') {
        setRunningActionStatus('Measuring latency & throughput on Cloudflare Edge...');
        result = await toolDef.execute(cleanArgs);
        if (result && result.downloadMbps) {
          addSpeedTestRecord({
            server: result.server || 'Cloudflare Edge (Auto)',
            pingMs: result.pingMs || 0,
            jitterMs: result.jitterMs || 0,
            downloadMbps: result.downloadMbps || 0,
            uploadMbps: result.uploadMbps || 0,
            interfaceName: networkInfo.interfaceName || 'Primary Adapter',
            status: 'complete',
          });
        }
      } else {
        result = await toolDef.execute(cleanArgs);
      }

      // If diagnostic tool, analyze findings
      let analysis: DiagnosticAnalysis | undefined;
      if (toolDef.name === 'diagnose_network' && result?.steps) {
        analysis = analyzeDiagnosticResults({
          steps: result.steps,
          telemetry: { wifi: networkInfo },
        });
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId && m.toolExecution) {
            return {
              ...m,
              toolExecution: {
                ...m.toolExecution,
                status: 'completed',
                result,
                analysis,
              },
              suggestedActions: analysis?.suggestedAction
                ? [analysis.suggestedAction]
                : undefined,
            };
          }
          return m;
        })
      );

      // Record network event if disruptive repair
      if (toolDef.name === 'flush_dns' || toolDef.name === 'renew_dhcp') {
        addNetworkEvent({
          type: 'info',
          severity: 'info',
          title: `AI Assistant: ${toolDef.displayName} Executed`,
          description: `Action completed successfully via NetX AI.`,
          evidence: JSON.stringify(result).slice(0, 120),
        });
      }

      return result;
    } catch (err: any) {
      const errStr = err?.message || String(err);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId && m.toolExecution) {
            return {
              ...m,
              toolExecution: {
                ...m.toolExecution,
                status: 'failed',
                error: errStr,
              },
            };
          }
          return m;
        })
      );
      throw err;
    } finally {
      setRunningActionStatus(null);
    }
  };

  // User submits prompt
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isProcessing) return;

    setInputQuery('');
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    const userMsg: UIMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    // ------------------------------------------------------------------------
    // PATH A: Ollama Local AI Online
    // ------------------------------------------------------------------------
    if (ollamaStatus.online && settings.ollamaModel) {
      try {
        setRunningActionStatus(`Thinking with ${settings.ollamaModel}...`);

        // Build conversation history for Ollama
        const historyForOllama: ChatMessage[] = [
          { role: 'system', content: NETX_AI_SYSTEM_PROMPT },
          ...messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .slice(-6)
            .map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          { role: 'user', content: query },
        ];

        const chatRes = await sendOllamaChat(
          settings.ollamaUrl,
          settings.ollamaModel,
          historyForOllama,
          settings.aiTemperature
        );

        if (!chatRes.ok || !chatRes.message) {
          throw new Error(chatRes.error || 'Failed to receive reply from Ollama.');
        }

        const asstMessage = chatRes.message;

        // Check if Ollama requested a native tool call
        const nativeToolCall = asstMessage.tool_calls?.[0];
        // Or check if model outputted fallback JSON
        const fallbackCall = extractFallbackJsonToolCall(asstMessage.content);

        const toolName = nativeToolCall?.function?.name || fallbackCall?.name;
        const toolArgs = nativeToolCall?.function?.arguments || fallbackCall?.args || {};

        if (toolName) {
          const toolDef = findToolByName(toolName);
          if (toolDef) {
            const validation = toolDef.validateArgs(toolArgs);
            const cleanArgs = validation.cleanArgs;

            // Check if tool requires user confirmation
            if (toolDef.requiresConfirmation && settings.aiConfirmActions) {
              const confirmMsg: UIMessage = {
                id: assistantMsgId,
                role: 'assistant',
                content:
                  asstMessage.content && asstMessage.content.trim()
                    ? asstMessage.content
                    : `I would like to run **${toolDef.displayName}**. Because this action could impact your network configuration, please confirm before I proceed.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                toolExecution: {
                  toolName: toolDef.name,
                  displayName: toolDef.displayName,
                  status: 'confirming',
                  args: cleanArgs,
                },
              };
              setMessages((prev) => [...prev, confirmMsg]);
              setIsProcessing(false);
              setRunningActionStatus(null);
              return;
            }

            // Execute tool immediately if no confirmation needed
            const toolMsg: UIMessage = {
              id: assistantMsgId,
              role: 'assistant',
              content: asstMessage.content || `Running **${toolDef.displayName}** to inspect live network conditions...`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              toolExecution: {
                toolName: toolDef.name,
                displayName: toolDef.displayName,
                status: 'running',
                args: cleanArgs,
              },
            };
            setMessages((prev) => [...prev, toolMsg]);

            const toolResult = await executeToolSafely(toolDef, cleanArgs, assistantMsgId);

            // Return result to Ollama to generate final verified explanation
            setRunningActionStatus('Analyzing measured results with Ollama...');
            const followUpHistory: ChatMessage[] = [
              ...historyForOllama,
              asstMessage,
              {
                role: 'tool',
                content: JSON.stringify(toolResult).slice(0, 4000),
              },
            ];

            const secondRes = await sendOllamaChat(
              settings.ollamaUrl,
              settings.ollamaModel,
              followUpHistory,
              settings.aiTemperature
            );

            if (secondRes.ok && secondRes.message?.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: secondRes.message!.content }
                    : m
                )
              );
            }
            setIsProcessing(false);
            setRunningActionStatus(null);
            return;
          }
        }

        // Direct answer with no tool call
        const directMsg: UIMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: asstMessage.content || 'I processed your query, but had no specific response.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, directMsg]);
      } catch (err: any) {
        console.error('Ollama chat error:', err);
        // Fallback to Native Engine if Ollama errors mid-request
        fallbackToNativeEngine(query, assistantMsgId, err?.message);
      } finally {
        setIsProcessing(false);
        setRunningActionStatus(null);
      }
      return;
    }

    // ------------------------------------------------------------------------
    // PATH B: Native NetX Network Engine Fallback (Ollama Offline)
    // ------------------------------------------------------------------------
    fallbackToNativeEngine(query, assistantMsgId);
  };

  // Fallback handler for deterministic natural language matching
  const fallbackToNativeEngine = async (
    query: string,
    assistantMsgId: string,
    ollamaError?: string
  ) => {
    setIsProcessing(true);
    const matched = matchUserIntent(query);

    if (matched) {
      const toolDef = findToolByName(matched.toolName);
      if (toolDef) {
        const validation = toolDef.validateArgs(matched.args);
        const cleanArgs = validation.cleanArgs;

        // Confirmation required?
        if (toolDef.requiresConfirmation && settings.aiConfirmActions) {
          const confirmMsg: UIMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: `I recognized your request to run **${toolDef.displayName}**. Because this action may alter network routing or disconnect connections, please confirm below to proceed.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            toolExecution: {
              toolName: toolDef.name,
              displayName: toolDef.displayName,
              status: 'confirming',
              args: cleanArgs,
            },
            isNativeFallback: true,
          };
          setMessages((prev) => [...prev, confirmMsg]);
          setIsProcessing(false);
          setRunningActionStatus(null);
          return;
        }

        // Execute directly
        const toolMsg: UIMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: `Executing **${toolDef.displayName}** using the NetX Native Network Engine...`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolExecution: {
            toolName: toolDef.name,
            displayName: toolDef.displayName,
            status: 'running',
            args: cleanArgs,
          },
          isNativeFallback: true,
        };
        setMessages((prev) => [...prev, toolMsg]);

        try {
          const result = await executeToolSafely(toolDef, cleanArgs, assistantMsgId);
          // Synthesize verified summary
          const summaryText = generateNativeSummaryText(toolDef.name, result, cleanArgs);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: summaryText }
                : m
            )
          );
        } catch (err: any) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: `❌ **${toolDef.displayName} Failed**: ${err?.message || String(err)}`,
                  }
                : m
            )
          );
        } finally {
          setIsProcessing(false);
          setRunningActionStatus(null);
        }
        return;
      }
    }

    // No matching tool found while offline
    const helpMsg: UIMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: `### ℹ️ NetX Local AI Assistant

${
  ollamaError
    ? `> ⚠️ **Ollama Communication Error**: ${ollamaError}\n`
    : `> 💡 **Ollama is currently offline** on \`${settings.ollamaUrl}\`. NetX executed in native deterministic mode.\n`
}

I didn't match a direct native command for *"${query}"*.

**Available Native Network Actions:**
* **"Run a speed test"** — Test download, upload, ping, and jitter against Cloudflare Edge
* **"Why is my internet slow?"** — Run a 4-step diagnostic check
* **"Ping [host]"** — e.g. \`ping 1.1.1.1\` or \`ping google.com\`
* **"Check DNS for [domain]"** — e.g. \`check dns for cloudflare.com\`
* **"Scan Wi-Fi"** — List nearby wireless networks and signal quality
* **"Find devices on LAN"** — Sweep your local subnet for active IP/MAC addresses
* **"Flush DNS cache"** — Clear local DNS cache with \`ipconfig /flushdns\`
* **"Summarize network"** — View live throughput, adapter specs, and usage

To enable full conversational AI reasoning and multi-turn open chat, launch **Ollama** with \`ollama run llama3.2\`.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isNativeFallback: true,
    };
    setMessages((prev) => [...prev, helpMsg]);
    setIsProcessing(false);
    setRunningActionStatus(null);
  };

  // Helper to generate natural text summaries when Ollama is offline
  const generateNativeSummaryText = (toolName: string, result: any, args: any): string => {
    switch (toolName) {
      case 'run_speed_test':
        return `✅ **Speed Test Completed**:
* **Download Speed**: **${result.downloadMbps} Mbps**
* **Upload Speed**: **${result.uploadMbps} Mbps**
* **Idle Latency**: **${result.pingMs} ms** (Jitter: **${result.jitterMs} ms**)
* **Test Endpoint**: ${result.server || 'Cloudflare Edge (Auto)'}
* **Interface**: ${networkInfo.interfaceName} (${networkInfo.connectionType})`;

      case 'diagnose_network':
        return `### 🩺 Diagnostic Findings Overview
${result.overallPassed ? '🟢 **All 4 baseline tests passed.** Your local network and internet routing are functioning normally.' : '⚠️ **Diagnostic issues detected.** Review the breakdown below for root cause and repair recommendations.'}`;

      case 'ping_host':
        if (result?.summary) {
          const s = result.summary;
          return `📡 **Ping Results for \`${args.host}\`**:
* Sent: **${s.sent}**, Received: **${s.received}**, Lost: **${s.lost} (${s.lossPct}% loss)**
* Latency: Min = **${s.minMs} ms**, Max = **${s.maxMs} ms**, Avg = **${s.avgMs} ms**`;
        }
        return `📡 Ping completed for \`${args.host}\`.`;

      case 'dns_lookup':
        if (result?.records?.length > 0) {
          return `🌐 **DNS Resolved for \`${args.domain}\`**: Found ${result.records.length} record(s) across A, AAAA, MX, NS, TXT.`;
        }
        return `⚠️ No DNS records found for \`${args.domain}\`.`;

      case 'list_wifi_networks':
        return `📶 **Wi-Fi Spectrum Scan**: Found **${result?.networks?.length || 0}** nearby access points in range.`;

      case 'discover_lan_devices':
        return `🖥️ **LAN Device Discovery**: Found **${result?.devices?.length || 0}** active device(s) on your local subnet (${networkInfo.ipv4 || '192.168.1.0/24'}).`;

      case 'flush_dns':
        return `🧹 **DNS Cache Flushed Successfully**: Windows IP Configuration successfully flushed the DNS Resolver Cache.`;

      case 'renew_dhcp':
        return `🔄 **DHCP Lease Renewed**: Successfully re-acquired IP configuration from your local router.`;

      case 'disconnect_wifi':
        return `🔌 **Wi-Fi Disconnected**: Disconnected from active wireless network.`;

      case 'export_diagnostic_report':
        return `📁 **Diagnostic Report Saved**: Saved to \`${result.filePath || 'Desktop'}\`.`;

      case 'get_network_summary':
        return `### 📊 Live Network Overview
* **Status**: ${networkInfo.connectionType} (${networkInfo.ssid !== 'Disconnected' ? networkInfo.ssid : networkInfo.interfaceName})
* **IP Addresses**: Local \`${networkInfo.ipv4}\` · Gateway \`${networkInfo.gateway}\` · Public \`${networkInfo.publicIp}\`
* **Real-Time Traffic**: ↓ ${currentDownloadMbps.toFixed(2)} Mbps · ↑ ${currentUploadMbps.toFixed(2)} Mbps
* **Data Transferred Today**: **${todayUsageGb.toFixed(2)} GB** (Month: **${monthUsageGb.toFixed(2)} GB**)`;

      default:
        return `Action completed successfully.`;
    }
  };

  // Confirmation button handlers
  const handleConfirmAction = async (messageId: string, toolName: string, args: any) => {
    const toolDef = findToolByName(toolName);
    if (!toolDef) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.toolExecution
          ? { ...m, toolExecution: { ...m.toolExecution, status: 'running' } }
          : m
      )
    );

    try {
      const result = await executeToolSafely(toolDef, args, messageId);
      const summaryText = generateNativeSummaryText(toolName, result, args);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: `${m.content}\n\n✅ **Action Confirmed & Executed**:\n${summaryText}`,
              }
            : m
        )
      );
      pushToast(`${toolDef.displayName} executed successfully`, 'success');
    } catch (err: any) {
      pushToast(`Failed to execute ${toolDef.displayName}: ${err?.message}`, 'warning');
    }
  };

  const handleCancelAction = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.toolExecution
          ? {
              ...m,
              toolExecution: { ...m.toolExecution, status: 'cancelled' },
              content: `${m.content}\n\n🛑 *Action was cancelled by user.*`,
            }
          : m
      )
    );
  };

  // Secure Wi-Fi Connect Handler
  const handleConnectWifiSubmit = async (messageId: string, ssid: string) => {
    const password = wifiPasswordInputs[ssid] || '';
    setRunningActionStatus(`Connecting to Wi-Fi "${ssid}"...`);

    try {
      const res = await window.netxNative?.connectWifi?.(ssid, password);
      const isConnected = Boolean(res?.connected);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                requiresPassword: { ssid, submitted: true },
                content: isConnected
                  ? `🎉 **Successfully connected to Wi-Fi "${ssid}"!** Link verified on \`${res?.interfaceInfo?.name || 'Wi-Fi'}\` (${res?.interfaceInfo?.signalQuality || 85}% signal).`
                  : `⚠️ **Connection Attempt Failed**: ${res?.error || 'Unable to connect to ' + ssid + '. Please verify the password and router range.'}`,
              }
            : m
        )
      );

      // Clean password from React state immediately
      setWifiPasswordInputs((prev) => {
        const next = { ...prev };
        delete next[ssid];
        return next;
      });

      if (isConnected) {
        pushToast(`Connected to ${ssid}`, 'success');
      } else {
        pushToast(`Failed to connect to ${ssid}`, 'warning');
      }
    } catch (err: any) {
      pushToast(`Wi-Fi error: ${err?.message}`, 'warning');
    } finally {
      setRunningActionStatus(null);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'msg-welcome-new',
        role: 'assistant',
        content: `Conversation history cleared. How can I assist you with your network?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    pushToast('Conversation history reset', 'info');
  };

  return (
    <div className="page-container ai-assistant-view" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '600px' }}>
      {/* 1. Header Bar: Provider, Model Selector & Ollama Status */}
      <div className="surface-card" style={{ padding: '12px 20px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>NetX AI Assistant</h2>
              <span className="badge-modern" style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--accent-purple)', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                Local LLM
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              100% On-Device Operations & Telemetry Intelligence
            </p>
          </div>
        </div>

        {/* Ollama Status Badge & Model Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {ollamaStatus.online ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.78rem', fontWeight: 600 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                Ollama {ollamaStatus.version || 'v0.5'}
              </div>

              {/* Model Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={14} style={{ color: 'var(--text-secondary)' }} />
                <select
                  value={settings.ollamaModel}
                  onChange={(e) => updateSettings({ ollamaModel: e.target.value })}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {ollamaStatus.models.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.parameterSize || `${(m.size / 1e9).toFixed(1)}GB`})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 600 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b' }}></span>
                Native Engine (Ollama Offline)
              </div>
              <button
                className="btn-secondary"
                onClick={() => setShowSetupModal(true)}
                style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <HelpCircle size={13} />
                Setup Ollama
              </button>
            </div>
          )}

          <button
            className="btn-icon"
            onClick={refreshOllama}
            disabled={isCheckingOllama}
            title="Refresh Ollama status"
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <RefreshCw size={14} className={isCheckingOllama ? 'spin' : ''} />
          </button>

          <button
            className="btn-icon"
            onClick={handleClearHistory}
            title="Clear conversation history"
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 2. Main Chat Conversation Body */}
      <div
        ref={chatScrollRef}
        className="surface-card"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '14px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              {msg.role === 'assistant' ? (
                <>
                  <Bot size={13} style={{ color: 'var(--accent-purple)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>NetX AI</span>
                  {msg.isNativeFallback && (
                    <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '1px 5px', borderRadius: '4px', fontSize: '0.68rem' }}>
                      Native Engine
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontWeight: 600 }}>You</span>
              )}
              <span>· {msg.timestamp}</span>
            </div>

            {/* Bubble */}
            <div
              style={{
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background:
                  msg.role === 'user'
                    ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
                    : 'var(--bg-secondary)',
                color: msg.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-default)',
                boxShadow: msg.role === 'user' ? '0 4px 12px rgba(124, 58, 237, 0.2)' : 'var(--shadow-sm)',
                fontSize: '0.9rem',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}

              {/* A. Tool Confirmation Card */}
              {msg.toolExecution && msg.toolExecution.status === 'confirming' && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px' }}>
                    <ShieldAlert size={18} />
                    <span>User Confirmation Required: {msg.toolExecution.displayName}</span>
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    This operation will modify active network adapters or routing. Active downloads, SSH sessions, or calls may momentarily disconnect.
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn-primary"
                      onClick={() => handleConfirmAction(msg.id, msg.toolExecution!.toolName, msg.toolExecution!.args)}
                      style={{ background: '#ef4444', borderColor: '#ef4444', fontSize: '0.82rem', padding: '6px 14px' }}
                    >
                      <CheckCircle2 size={14} style={{ marginRight: '6px' }} />
                      Confirm & Execute
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleCancelAction(msg.id)}
                      style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                    >
                      <X size={14} style={{ marginRight: '6px' }} />
                      Cancel Action
                    </button>
                  </div>
                </div>
              )}

              {/* B. Tool Running Progress Indicator */}
              {msg.toolExecution && msg.toolExecution.status === 'running' && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(124, 58, 237, 0.1)',
                    border: '1px solid rgba(124, 58, 237, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.84rem',
                    color: 'var(--accent-purple)',
                    fontWeight: 600,
                  }}
                >
                  <RefreshCw size={16} className="spin" />
                  <span>Executing {msg.toolExecution.displayName}...</span>
                </div>
              )}

              {/* C. Diagnostic Structured Breakdown Card */}
              {msg.toolExecution?.analysis && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      Diagnostic Fault Domain
                    </span>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        background:
                          msg.toolExecution.analysis.status === 'healthy'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : msg.toolExecution.analysis.status === 'warning'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          msg.toolExecution.analysis.status === 'healthy'
                            ? '#10b981'
                            : msg.toolExecution.analysis.status === 'warning'
                            ? '#f59e0b'
                            : '#ef4444',
                      }}
                    >
                      {msg.toolExecution.analysis.faultDomain}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                    <strong>Confidence:</strong> {msg.toolExecution.analysis.confidence}
                  </div>

                  {/* Supporting Evidence */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      VERIFIED MEASUREMENTS:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem' }}>
                      {msg.toolExecution.analysis.evidence.map((ev, i) => (
                        <li key={i} style={{ marginBottom: '2px' }}>{ev}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      RECOMMENDED ACTION:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem' }}>
                      {msg.toolExecution.analysis.recommendations.map((rec, i) => (
                        <li key={i} style={{ marginBottom: '2px' }}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* D. Wi-Fi Secure Password Prompt Card */}
              {msg.requiresPassword && !msg.requiresPassword.submitted && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px' }}>
                    <Lock size={16} style={{ color: 'var(--accent-purple)' }} />
                    <span>Password Required for "{msg.requiresPassword.ssid}"</span>
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    🔒 Password is used directly by Windows to establish the connection and is <strong>never sent to the AI model or logged</strong>.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type={showWifiPassword[msg.requiresPassword.ssid] ? 'text' : 'password'}
                      placeholder="Enter Wi-Fi security key..."
                      value={wifiPasswordInputs[msg.requiresPassword.ssid] || ''}
                      onChange={(e) =>
                        setWifiPasswordInputs((prev) => ({
                          ...prev,
                          [msg.requiresPassword!.ssid]: e.target.value,
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                      }}
                    />
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        setShowWifiPassword((prev) => ({
                          ...prev,
                          [msg.requiresPassword!.ssid]: !prev[msg.requiresPassword!.ssid],
                        }))
                      }
                      style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                    >
                      {showWifiPassword[msg.requiresPassword.ssid] ? 'Hide' : 'Show'}
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => handleConnectWifiSubmit(msg.id, msg.requiresPassword!.ssid)}
                      style={{ padding: '6px 14px', fontSize: '0.84rem' }}
                    >
                      Connect
                    </button>
                  </div>
                </div>
              )}

              {/* E. Actionable Suggestion Buttons */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {msg.suggestedActions.map((act, i) => (
                    <button
                      key={i}
                      className="btn-secondary"
                      onClick={() => handleSendMessage(`Run ${act.label}`)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(124, 58, 237, 0.1)',
                        borderColor: 'rgba(124, 58, 237, 0.3)',
                        color: 'var(--accent-purple)',
                        fontWeight: 600,
                      }}
                    >
                      <Wrench size={13} />
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live execution status indicator */}
        {runningActionStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.2)', color: 'var(--accent-purple)', fontSize: '0.85rem', fontWeight: 600, alignSelf: 'flex-start' }}>
            <RefreshCw size={15} className="spin" />
            <span>{runningActionStatus}</span>
          </div>
        )}
      </div>

      {/* 3. Quick Action Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', whiteSpace: 'nowrap' }}>
        {QUICK_PROMPTS.map((p, i) => (
          <button
            key={i}
            className="btn-secondary"
            onClick={() => handleSendMessage(p.query)}
            disabled={isProcessing}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              borderRadius: '20px',
              fontWeight: 600,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 4. Natural-Language Input Bar */}
      <div className="surface-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask NetX AI anything about your network, or run diagnostics..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={isProcessing}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.92rem',
            padding: '6px 4px',
          }}
        />

        <button
          className="btn-primary"
          onClick={() => handleSendMessage()}
          disabled={!inputQuery.trim() || isProcessing}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <Send size={15} />
          Send
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
        <span>🔒 NetX AI operates locally via Ollama. No network data or credentials leave your PC.</span>
        <span>Press <kbd style={{ padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)' }}>Enter</kbd> to send</span>
      </div>

      {/* 5. Ollama Setup Modal */}
      {showSetupModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="surface-card"
            style={{
              width: '90%',
              maxWidth: '600px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={22} style={{ color: 'var(--accent-purple)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Ollama Local AI Setup</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowSetupModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              NetX uses <strong>Ollama</strong> as its on-device neural reasoning engine. Running Ollama locally gives you private, fast, offline network intelligence with zero API keys.
            </p>

            <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.92rem', color: 'var(--text-primary)' }}>1. Install Ollama for Windows</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Download and install the official Windows installer from the Ollama project website:
              </p>
              <a
                href="https://ollama.com/download/windows"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', padding: '6px 14px' }}
              >
                <Download size={14} />
                Download Ollama for Windows
                <ExternalLink size={12} />
              </a>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.92rem', color: 'var(--text-primary)' }}>2. Pull a Recommended Model</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Open PowerShell or Windows Terminal and run one of these commands to download a model:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {RECOMMENDED_MODELS.map((m) => (
                  <div
                    key={m.tag}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                        {m.name} ({m.paramSize})
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>VRAM: {m.vram}</span>
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{m.description}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '6px' }}>
                      <code style={{ fontSize: '0.8rem', color: 'var(--accent-purple)' }}>{m.command}</code>
                      <button
                        className="btn-icon"
                        title="Copy command"
                        onClick={() => {
                          navigator.clipboard.writeText(m.command);
                          pushToast(`Copied "${m.command}"`, 'info');
                        }}
                        style={{ width: '26px', height: '26px' }}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn-primary"
                onClick={async () => {
                  await refreshOllama();
                  if (ollamaStatus.online) {
                    setShowSetupModal(false);
                    pushToast('Ollama connected successfully!', 'success');
                  }
                }}
                style={{ fontSize: '0.86rem', padding: '8px 18px' }}
              >
                Test Connection & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
