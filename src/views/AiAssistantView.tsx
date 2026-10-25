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
  Key,
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
  sendGeminiChat,
  GeminiChatTurn,
  testGeminiApiKey,
  DEFAULT_GEMINI_API_KEY,
  DEFAULT_GEMINI_MODEL,
} from '../services/geminiClient';
import {
  NETX_AI_TOOLS,
  findToolByName,
  ToolDefinition,
} from '../services/aiToolRegistry';
import { matchUserIntent, matchConversationalIntent } from '../services/intentMatcher';
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
    toolName?: string;
    label: string;
    query?: string;
    args?: any;
    description?: string;
  }>;
  isNativeFallback?: boolean;
}

const QUICK_PROMPTS = [
  { label: '📶 Available Wi-Fi', query: 'Check for available Wi-Fi' },
  { label: '⚡ Speed Test', query: 'Run an internet speed test' },
  { label: '🩺 Diagnose Network', query: 'Why is my internet slow? Diagnose my connection' },
  { label: '🌐 Check DNS', query: 'Check if my DNS is working for cloudflare.com' },
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
    internetReachable,
    connected,
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

  const [userName, setUserName] = useState<string>(settings.customUserName || 'Kurui');

  // Load OS username dynamically if available
  useEffect(() => {
    if (window.netxNative?.getSystemUser) {
      window.netxNative
        .getSystemUser()
        .then((user) => {
          if (user?.username && !settings.customUserName) {
            setUserName(user.username);
          }
        })
        .catch(() => {});
    }
  }, [settings.customUserName]);

  const [messages, setMessages] = useState<UIMessage[]>(() => {
    try {
      const stored = localStorage.getItem('netx-ai-messages-v2');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    const initialName = settings.customUserName || 'Kurui';
    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: `👋 Hello, **${initialName}**! I am **NetX AI**, your personal network intelligence assistant.

I can test your connection speed, scan nearby Wi-Fi networks and help you connect, run diagnostic checks, ping hosts, and troubleshoot your network in real-time.

How can I help you today? Feel free to ask anything or tap one of the quick suggestions below!`,
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
      localStorage.setItem('netx-ai-messages-v2', JSON.stringify(messages.slice(-30)));
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

  // Helper to generate verified natural text summaries
  function generateNativeSummaryText(toolName: string, result: any, args: any): string {
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
${
  result.overallPassed
    ? '🟢 **All 4 baseline tests passed.** Your local network and internet routing are functioning normally.'
    : '⚠️ **Diagnostic issues detected.** Review the breakdown below for root cause and repair recommendations.'
}`;

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

      case 'list_wifi_networks': {
        const nets = result?.networks || [];
        if (nets.length === 0) {
          return `📶 **Wi-Fi Spectrum Scan**: No wireless networks detected in range. Ensure your Wi-Fi adapter is enabled.`;
        }
        const lines = nets.slice(0, 8).map((n: any) => {
          const statusIcon = n.connected ? '🟢 *(Connected)*' : '📶';
          return `* ${statusIcon} **${n.ssid}** — **${n.signalQuality}%** (${n.signalDbm} dBm) · ${n.band} · ${n.security}`;
        });
        return `### 📶 Available Wi-Fi Networks Nearby (${nets.length} detected)

${lines.join('\n')}

💡 *To connect, simply tell me the Wi-Fi name and password (e.g. "Connect to ${nets[0]?.ssid || 'Home_5G'} with password yourkey") or click Connect below!*`;
      }

      case 'connect_wifi': {
        if (result?.connected || result?.ok) {
          return `✅ **Successfully Connected to "${args.ssid}"**!
* **Network Status**: Associated & Online
* **Signal Quality**: ${result.interfaceInfo?.signalQuality || 100}% (${result.interfaceInfo?.signalDbm || -45} dBm)
* **Link Speed**: ${result.interfaceInfo?.linkSpeedMbps || 144} Mbps
* **Assigned IP**: ${result.interfaceInfo?.ipv4 || networkInfo.ipv4 || 'Configured via DHCP'}`;
        }
        return `❌ **Unable to Connect to "${args.ssid}"**:
${result?.error || 'Failed to authenticate. Please ensure the security key is correct and the network is within range.'}`;
      }

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
  }

  const activeGeminiKey = (settings.geminiApiKey && settings.geminiApiKey.trim()) || DEFAULT_GEMINI_API_KEY;
  const canUseGemini =
    settings.aiProvider !== 'ollama' &&
    settings.aiProvider !== 'offline' &&
    Boolean(activeGeminiKey) &&
    internetReachable;

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
      } else if (toolDef.name === 'list_wifi_networks') {
        setRunningActionStatus('Scanning 2.4 GHz & 5 GHz wireless spectrum...');
        result = await toolDef.execute(cleanArgs);
      } else if (toolDef.name === 'connect_wifi') {
        setRunningActionStatus(`Connecting to Wi-Fi "${cleanArgs.ssid}"...`);
        result = await toolDef.execute(cleanArgs);
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

      const summaryText = generateNativeSummaryText(toolDef.name, result, cleanArgs);

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId && m.toolExecution) {
            return {
              ...m,
              content: summaryText,
              toolExecution: {
                ...m.toolExecution,
                status: 'completed',
                result,
                analysis,
              },
              suggestedActions: analysis?.suggestedAction
                ? [
                    {
                      toolName: analysis.suggestedAction.toolName,
                      label: analysis.suggestedAction.label,
                      query: `Run ${analysis.suggestedAction.label}`,
                      description: analysis.suggestedAction.description,
                    },
                  ]
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
              content: `❌ **${toolDef.displayName} Failed**: ${errStr}`,
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

  const handleConfirmToolExecution = async (messageId: string) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.toolExecution) return;

    const toolDef = findToolByName(targetMsg.toolExecution.toolName);
    if (!toolDef) return;

    setIsProcessing(true);
    setRunningActionStatus(`Executing ${toolDef.displayName}...`);

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.toolExecution
          ? {
              ...m,
              content: `Executing **${toolDef.displayName}**...`,
              toolExecution: {
                ...m.toolExecution,
                status: 'running',
              },
            }
          : m
      )
    );

    try {
      const toolResult = await executeToolSafely(toolDef, targetMsg.toolExecution.args, messageId);

      // If online with Gemini, synthesize conversational synthesis
      if (canUseGemini) {
        setRunningActionStatus('Synthesizing verified results with Gemini...');
        try {
          const followUpTurns: GeminiChatTurn[] = [
            ...messages
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .slice(-6)
              .map((m) => ({
                role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
                parts: [{ text: m.content }],
              })),
            {
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    name: toolDef.name,
                    response: { output: toolResult },
                  },
                },
              ],
            },
          ];

          const secondRes = await sendGeminiChat(
            activeGeminiKey,
            settings.geminiModel || DEFAULT_GEMINI_MODEL,
            followUpTurns,
            settings.aiTemperature
          );

          if (secondRes.ok && secondRes.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId ? { ...m, content: secondRes.text! } : m
              )
            );
          }
        } catch {
          // Native summary text is already set by executeToolSafely
        }
      }
    } catch (err: any) {
      console.error('Confirmation tool execution error:', err);
    } finally {
      setIsProcessing(false);
      setRunningActionStatus(null);
    }
  };

  const handleCancelToolExecution = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.toolExecution
          ? {
              ...m,
              content: `Execution of **${m.toolExecution.displayName}** was cancelled.`,
              toolExecution: {
                ...m.toolExecution,
                status: 'cancelled',
              },
            }
          : m
      )
    );
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

    // Check for Pending Action Confirmation ("yes", "confirm", "proceed", "cancel", etc.)
    const pendingConfirmMsg = [...messages].reverse().find(
      (m) => m.toolExecution?.status === 'confirming'
    );

    if (pendingConfirmMsg && pendingConfirmMsg.toolExecution) {
      const lowerQuery = query.toLowerCase().trim();
      const isAffirmative = /^(yes|y|confirm|confirmed|proceed|go ahead|do it|sure|ok|okay|run it|continue|execute|flush)/i.test(lowerQuery);
      const isNegative = /^(no|n|cancel|cancelled|stop|abort|don't|dont|nevermind|quit)/i.test(lowerQuery);

      if (isAffirmative) {
        await handleConfirmToolExecution(pendingConfirmMsg.id);
        return;
      } else if (isNegative) {
        handleCancelToolExecution(pendingConfirmMsg.id);
        return;
      }
    }

    setIsProcessing(true);
    setRunningActionStatus('NetX AI is thinking...');

    // ========================================================================
    // FAST PATH: Instant Conversational Greetings & Small Talk (Sub-300ms)
    // ========================================================================
    const convIntent = matchConversationalIntent(query, userName);
    if (convIntent) {
      setRunningActionStatus('NetX AI is replying...');
      // Brief 250ms bounce for visible yet ultra-snappy typing dots
      await new Promise((r) => setTimeout(r, 250));
      const directMsg: UIMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: convIntent.replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: convIntent.suggestedActions,
      };
      setMessages((prev) => [...prev, directMsg]);
      setIsProcessing(false);
      setRunningActionStatus(null);
      return;
    }

    // ========================================================================
    // FAST PATH: Direct Network Intent Dispatch (Immediate local execution)
    // Runs commands like "check wifi", "speed test", "ping 8.8.8.8", "connect to..."
    // immediately without waiting for a 2-roundtrip 8-second cloud LLM loop.
    // ========================================================================
    const directTool = matchUserIntent(query);
    if (directTool) {
      const toolDef = findToolByName(directTool.toolName);
      if (toolDef) {
        const cleanArgs = toolDef.validateArgs(directTool.args).cleanArgs;

        // Disruptive confirmation check
        if (toolDef.requiresConfirmation && settings.aiConfirmActions) {
          const confirmMsg: UIMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: `I would like to run **${toolDef.displayName}**. Because this action could impact your network connection, please confirm below to proceed.`,
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

        // Run tool immediately
        const toolMsg: UIMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: `Running **${toolDef.displayName}** to inspect live network conditions...`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolExecution: {
            toolName: toolDef.name,
            displayName: toolDef.displayName,
            status: 'running',
            args: cleanArgs,
          },
        };
        setMessages((prev) => [...prev, toolMsg]);
        await executeToolSafely(toolDef, cleanArgs, assistantMsgId);
        setIsProcessing(false);
        setRunningActionStatus(null);
        return;
      }
    }

    // ========================================================================
    // PATH 1: Google Gemini Free Cloud AI (Fast Reasoning & Open-ended Chat)
    // Auto-detects connectivity: uses Gemini when online, native engine when offline
    // ========================================================================
    // Using component-level activeGeminiKey and canUseGemini

    if (canUseGemini) {
      try {
        setRunningActionStatus('Thinking with Google Gemini...');

        // Build conversation history for Gemini
        const geminiHistory: GeminiChatTurn[] = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-8)
          .map((m) => ({
            role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
            parts: [{ text: m.content }],
          }));

        const lastSpeedTest = speedTestHistory[0];
        let telemetrySnippet = `[Context: Interface=${networkInfo.interfaceName || 'Wi-Fi'}, Connection=${networkInfo.connectionType || 'Connected'}, SSID=${networkInfo.ssid || 'None'} (${networkInfo.signalQuality}% signal)`;
        if (lastSpeedTest) {
          telemetrySnippet += `, Recent Speed Test: ${lastSpeedTest.downloadMbps} Mbps down, ${lastSpeedTest.uploadMbps} Mbps up, ${lastSpeedTest.pingMs}ms latency on ${lastSpeedTest.server}`;
        }
        telemetrySnippet += `]`;

        geminiHistory.push({
          role: 'user',
          parts: [{ text: `${telemetrySnippet}\n\n${query}` }],
        });

        const geminiRes = await sendGeminiChat(
          activeGeminiKey,
          settings.geminiModel || DEFAULT_GEMINI_MODEL,
          geminiHistory,
          settings.aiTemperature
        );

        if (!geminiRes.ok) {
          throw new Error(geminiRes.error || 'Failed to receive reply from Gemini');
        }

        // If Gemini called a network tool
        if (geminiRes.toolCall) {
          const toolName = geminiRes.toolCall.name;
          const toolArgs = geminiRes.toolCall.args;
          const toolDef = findToolByName(toolName);

          if (toolDef) {
            const validation = toolDef.validateArgs(toolArgs);
            const cleanArgs = validation.cleanArgs;

            // Disruptive confirmation check
            if (toolDef.requiresConfirmation && settings.aiConfirmActions) {
              const confirmMsg: UIMessage = {
                id: assistantMsgId,
                role: 'assistant',
                content: `I would like to run **${toolDef.displayName}**. Because this action could impact your network connection, please confirm below to proceed.`,
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

            // Run tool immediately
            const toolMsg: UIMessage = {
              id: assistantMsgId,
              role: 'assistant',
              content: `Running **${toolDef.displayName}** to inspect live network conditions...`,
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

            // Feed tool result back to Gemini for conversational synthesis
            setRunningActionStatus('Synthesizing verified results...');
            const followUpTurns: GeminiChatTurn[] = [
              ...geminiHistory,
              {
                role: 'model',
                parts: geminiRes.rawParts || [{ functionCall: { name: toolName, args: toolArgs } }],
              },
              {
                role: 'user',
                parts: [
                  {
                    functionResponse: {
                      name: toolName,
                      response: { output: toolResult },
                    },
                  },
                ],
              },
            ];

            const secondRes = await sendGeminiChat(
              activeGeminiKey,
              settings.geminiModel || DEFAULT_GEMINI_MODEL,
              followUpTurns,
              settings.aiTemperature
            );

            if (secondRes.ok && secondRes.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: secondRes.text! }
                    : m
                )
              );
            } else {
              const summaryText = generateNativeSummaryText(toolDef.name, toolResult, cleanArgs);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: summaryText }
                    : m
                )
              );
            }
            setIsProcessing(false);
            setRunningActionStatus(null);
            return;
          }
        }

        // Direct conversational text answer
        const directMsg: UIMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: geminiRes.text || `Hello **${userName}**! How can I help you today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, directMsg]);
        setIsProcessing(false);
        setRunningActionStatus(null);
        return;
      } catch (err: any) {
        console.warn('Gemini cloud call unavailable, seamlessly falling back to native engine:', err);
        fallbackToNativeEngine(query, assistantMsgId);
        return;
      }
    }

    // ========================================================================
    // PATH 2: Local Ollama Neural Engine
    // ========================================================================
    if (settings.aiProvider === 'ollama' && ollamaStatus.online && settings.ollamaModel) {
      try {
        setRunningActionStatus(`Thinking with ${settings.ollamaModel}...`);

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
        const nativeToolCall = asstMessage.tool_calls?.[0];
        const fallbackCall = extractFallbackJsonToolCall(asstMessage.content);

        const toolName = nativeToolCall?.function?.name || fallbackCall?.name;
        const toolArgs = nativeToolCall?.function?.arguments || fallbackCall?.args || {};

        if (toolName) {
          const toolDef = findToolByName(toolName);
          if (toolDef) {
            const validation = toolDef.validateArgs(toolArgs);
            const cleanArgs = validation.cleanArgs;

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

        const directMsg: UIMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: asstMessage.content || `Hello **${userName}**! How can I help you today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, directMsg]);
        setIsProcessing(false);
        setRunningActionStatus(null);
        return;
      } catch (err: any) {
        console.error('Ollama chat error:', err);
        fallbackToNativeEngine(query, assistantMsgId, err?.message);
        return;
      }
    }

    // ========================================================================
    // PATH 3: Smart Conversational Offline Engine
    // ========================================================================
    fallbackToNativeEngine(query, assistantMsgId);
  };

  // Fallback handler for deterministic natural language matching and friendly small-talk
  const fallbackToNativeEngine = async (
    query: string,
    assistantMsgId: string,
    apiError?: string
  ) => {
    setIsProcessing(true);

    // 1. Check friendly conversational intent ("hey", "hello", "who are you", "thanks")
    const convIntent = matchConversationalIntent(query, userName);
    if (convIntent) {
      // Natural brief thinking interlude
      await new Promise((r) => setTimeout(r, 380));
      const convMsg: UIMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: convIntent.replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: convIntent.suggestedActions?.map((a) => ({
          label: a.label,
          query: a.query,
        })),
        isNativeFallback: true,
      };
      setMessages((prev) => [...prev, convMsg]);
      setIsProcessing(false);
      setRunningActionStatus(null);
      return;
    }

    // 2. Check network command intent
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

    // 3. Statement outside offline toolkit
    await new Promise((r) => setTimeout(r, 220));
    const isOffline = !internetReachable;
    const helpMsg: UIMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: isOffline
        ? `Hey **${userName}**, your PC is currently **offline**! 📶

In offline mode, I can still scan available Wi-Fi networks, help you connect with your Wi-Fi password, ping your local gateway, or diagnose your network adapter. Once you reconnect to the internet, open-ended cloud conversations will resume automatically!`
        : `Hey **${userName}**, I'm currently using the NetX Native Network Engine.

I can scan all nearby Wi-Fi networks, run an internet speed test on Cloudflare Edge, ping any server, or run full diagnostics across your adapter and DNS. Choose an action below or tell me what to test!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: [
        { label: '📶 Check Available Wi-Fi', query: 'Check for available Wi-Fi' },
        { label: '⚡ Run Speed Test', query: 'Run an internet speed test' },
        { label: '🩺 Diagnose Connection', query: 'Why is my internet slow? Diagnose my connection' },
      ],
      isNativeFallback: true,
    };
    setMessages((prev) => [...prev, helpMsg]);
    setIsProcessing(false);
    setRunningActionStatus(null);
  };

  // Connect Wi-Fi trigger from card
  const handleInitiateWifiConnect = (messageId: string, ssid: string, security: string) => {
    const isOpen = security.toLowerCase().includes('open') || security.toLowerCase().includes('none');
    if (isOpen) {
      handleSendMessage(`Connect to ${ssid}`);
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, requiresPassword: { ssid, submitted: false } }
            : m
        )
      );
    }
  };

  const handleConnectWifiSubmit = async (messageId: string, ssid: string) => {
    const password = wifiPasswordInputs[ssid] || '';
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.requiresPassword
          ? { ...m, requiresPassword: { ...m.requiresPassword, submitted: true } }
          : m
      )
    );
    handleSendMessage(`Connect to ${ssid} with password ${password}`);
  };

  const clearChatHistory = () => {
    const initialName = settings.customUserName || userName || 'Kurui';
    const fresh: UIMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `Chat history cleared. Hello, **${initialName}**! How can I assist with your network today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([fresh]);
    try {
      localStorage.removeItem('netx-ai-messages-v2');
    } catch {}
    pushToast('Chat conversation cleared.', 'info');
  };

  return (
    <div className="page-container" style={{ height: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 1. Header Toolbar */}
      <div className="surface-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-accent)' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '0.98rem' }}>NetX AI Assistant</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontWeight: 650,
                  background:
                    settings.aiProvider === 'gemini' && internetReachable
                      ? 'rgba(16, 185, 129, 0.15)'
                      : settings.aiProvider === 'ollama' && ollamaStatus.online
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(139, 92, 246, 0.15)',
                  color:
                    settings.aiProvider === 'gemini' && internetReachable
                      ? '#10b981'
                      : settings.aiProvider === 'ollama' && ollamaStatus.online
                      ? '#10b981'
                      : 'var(--brand-accent)',
                }}
              >
                {settings.aiProvider === 'gemini'
                  ? internetReachable
                    ? '⚡ Gemini Online (Cloud)'
                    : '💻 Offline Mode (Auto)'
                  : settings.aiProvider === 'ollama' && ollamaStatus.online
                  ? `⚡ Ollama (${settings.ollamaModel})`
                  : '💻 Offline Native Engine'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Personalized for <strong style={{ color: 'var(--brand-accent)' }}>{userName}</strong> · Network Diagnostics &amp; Chat
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn-secondary"
            onClick={() => setActiveNav('settings')}
            style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
            title="Configure AI model or add free Gemini key"
          >
            <Key size={13} />
            <span>AI Settings</span>
          </button>
          <button
            className="btn-ghost"
            onClick={clearChatHistory}
            style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}
            title="Clear conversation"
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 2. Message History Viewport */}
      <div
        ref={chatScrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '12px 4px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: 12,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: msg.role === 'user' ? '82%' : '88%',
            }}
          >
            {msg.role !== 'user' && (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--brand-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-accent)',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <Bot size={17} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background:
                    msg.role === 'user'
                      ? 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)'
                      : 'var(--bg-surface-elevated)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-default)',
                  color: msg.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                  fontSize: '0.90rem',
                  lineHeight: 1.55,
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>

              {/* Wi-Fi Quick Connect Cards (if list_wifi_networks completed) */}
              {msg.toolExecution?.toolName === 'list_wifi_networks' &&
                msg.toolExecution.status === 'completed' &&
                msg.toolExecution.result?.networks?.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', paddingLeft: 2 }}>
                      DETECTED WIRELESS NETWORKS:
                    </div>
                    {msg.toolExecution.result.networks.slice(0, 6).map((net: any) => (
                      <div key={net.bssid || net.ssid} className="wifi-quick-card">
                        <div className="wifi-quick-left">
                          <Wifi size={15} style={{ color: net.connected ? 'var(--status-success)' : 'var(--brand-accent)' }} />
                          <div>
                            <div className="wifi-quick-name">
                              {net.ssid}
                              {net.connected && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--status-success)', marginLeft: 6, fontWeight: 700 }}>
                                  ● Active
                                </span>
                              )}
                            </div>
                            <div className="wifi-quick-meta">
                              {net.signalQuality}% signal ({net.signalDbm} dBm) · {net.band} · {net.security}
                            </div>
                          </div>
                        </div>
                        {!net.connected && (
                          <button
                            className="btn-primary"
                            style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                            onClick={() => handleInitiateWifiConnect(msg.id, net.ssid, net.security)}
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              {/* Speed Test Metrics Card (if run_speed_test completed) */}
              {msg.toolExecution?.toolName === 'run_speed_test' &&
                msg.toolExecution.status === 'completed' &&
                msg.toolExecution.result && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.80rem', color: 'var(--brand-accent)' }}>
                        <Gauge size={15} />
                        <span>VERIFIED SPEED TEST METRICS</span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {msg.toolExecution.result.server || 'Cloudflare Edge (Auto)'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <div
                        style={{
                          padding: '10px',
                          borderRadius: 8,
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          <Download size={13} style={{ color: '#10b981' }} />
                          <span>DOWNLOAD</span>
                        </div>
                        <div style={{ fontSize: '1.28rem', fontWeight: 800, color: '#10b981' }}>
                          {msg.toolExecution.result.downloadMbps ?? '--'}
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, marginLeft: 3 }}>Mbps</span>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '10px',
                          borderRadius: 8,
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          <Upload size={13} style={{ color: 'var(--series-download)' }} />
                          <span>UPLOAD</span>
                        </div>
                        <div style={{ fontSize: '1.28rem', fontWeight: 800, color: 'var(--series-download)' }}>
                          {msg.toolExecution.result.uploadMbps ?? '--'}
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, marginLeft: 3 }}>Mbps</span>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '10px',
                          borderRadius: 8,
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          <Activity size={13} style={{ color: 'var(--brand-accent)' }} />
                          <span>LATENCY</span>
                        </div>
                        <div style={{ fontSize: '1.28rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {msg.toolExecution.result.pingMs ?? '--'}
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, marginLeft: 3 }}>ms</span>
                        </div>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                          Jitter: {msg.toolExecution.result.jitterMs ?? 0} ms
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Network Diagnostic Verification Card */}
              {msg.toolExecution?.toolName === 'diagnose_network' &&
                msg.toolExecution.status === 'completed' &&
                msg.toolExecution.result?.steps && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.80rem', color: 'var(--brand-accent)' }}>
                      <ShieldCheck size={15} />
                      <span>DIAGNOSTIC VERIFICATION STAGES</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {Object.entries(msg.toolExecution.result.steps).map(([k, step]: [string, any]) => (
                        <div
                          key={k}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: 'var(--bg-surface-elevated)',
                            border: `1px solid ${step?.passed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          {step?.passed ? (
                            <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                          ) : (
                            <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                          )}
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                              {k} Check
                            </div>
                            <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {step?.passed ? `${step?.latencyMs ? `${step.latencyMs} ms · ` : ''}Normal` : step?.error || 'Issue detected'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Inline Wi-Fi Password Prompt */}
              {msg.requiresPassword && !msg.requiresPassword.submitted && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 10,
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>
                    <Lock size={15} style={{ color: 'var(--brand-accent)' }} />
                    <span>Enter Password for "{msg.requiresPassword.ssid}"</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type={showWifiPassword[msg.requiresPassword.ssid] ? 'text' : 'password'}
                      placeholder="Wi-Fi security key..."
                      value={wifiPasswordInputs[msg.requiresPassword.ssid] || ''}
                      onChange={(e) =>
                        setWifiPasswordInputs((prev) => ({
                          ...prev,
                          [msg.requiresPassword!.ssid]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleConnectWifiSubmit(msg.id, msg.requiresPassword!.ssid);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'var(--bg-surface-subtle)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                      }}
                    />
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                      onClick={() =>
                        setShowWifiPassword((prev) => ({
                          ...prev,
                          [msg.requiresPassword!.ssid]: !prev[msg.requiresPassword!.ssid],
                        }))
                      }
                    >
                      {showWifiPassword[msg.requiresPassword.ssid] ? 'Hide' : 'Show'}
                    </button>
                    <button
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                      onClick={() => handleConnectWifiSubmit(msg.id, msg.requiresPassword!.ssid)}
                    >
                      Connect
                    </button>
                  </div>
                </div>
              )}

              {/* Action Confirmation Card (when toolExecution.status === 'confirming') */}
              {msg.toolExecution?.status === 'confirming' && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <AlertTriangle size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Confirm Action: {msg.toolExecution.displayName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {msg.toolExecution.toolName === 'flush_dns'
                          ? 'Clears Windows DNS cache to resolve hostname lookups. Non-destructive.'
                          : msg.toolExecution.toolName === 'renew_dhcp'
                          ? 'Renews local IP from router. May interrupt active connections for 2-4 seconds.'
                          : msg.toolExecution.toolName === 'disconnect_wifi'
                          ? 'Disconnects from the active wireless network.'
                          : 'Requires user confirmation before running.'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <button
                      className="btn-primary"
                      onClick={() => handleConfirmToolExecution(msg.id)}
                      style={{
                        padding: '6px 14px',
                        fontSize: '0.80rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#0284c7',
                        border: 'none',
                        color: '#ffffff',
                        fontWeight: 650,
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <CheckCircle2 size={14} />
                      Confirm &amp; Run
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleCancelToolExecution(msg.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.80rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action Suggestion Chips */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {msg.suggestedActions.map((act, i) => (
                    <button
                      key={i}
                      className="btn-secondary"
                      onClick={() => handleSendMessage(act.query || `Run ${act.label}`)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(14, 165, 233, 0.12)',
                        borderColor: 'rgba(14, 165, 233, 0.3)',
                        color: 'var(--brand-accent)',
                        fontWeight: 600,
                      }}
                    >
                      <Sparkles size={12} />
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 3. ChatGPT-Style Animated Thinking Indicator */}
        {isProcessing && (
          <div className="typing-bubble-container">
            <div className="typing-avatar-glow">
              <Sparkles size={15} />
            </div>
            <div className="typing-dots">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
            <span className="typing-status-label">{runningActionStatus || 'NetX AI is thinking...'}</span>
          </div>
        )}
      </div>

      {/* 4. Quick Action Chips */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, whiteSpace: 'nowrap' }}>
        {QUICK_PROMPTS.map((p, i) => (
          <button
            key={i}
            className="btn-secondary"
            onClick={() => handleSendMessage(p.query)}
            disabled={isProcessing}
            style={{
              padding: '5px 12px',
              fontSize: '0.78rem',
              borderRadius: 18,
              fontWeight: 600,
              background: 'var(--bg-surface-subtle)',
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

      {/* 5. Natural-Language Input Bar */}
      <div className="surface-card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask NetX AI anything, scan Wi-Fi, or test connection..."
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
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
        >
          <Send size={14} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
