/**
 * NetX Ollama Client Service
 * Connects to local Ollama API via native Electron IPC (or browser fallback),
 * handles model discovery, status polling, and conversational tool calling.
 */

import { OllamaModelInfo } from '../types/netx';
import { getOllamaToolsSchema, findToolByName } from './aiToolRegistry';

export interface RecommendedModel {
  name: string;
  tag: string;
  paramSize: string;
  description: string;
  command: string;
  vram: string;
}

export const RECOMMENDED_MODELS: RecommendedModel[] = [
  {
    name: 'Llama 3.2',
    tag: 'llama3.2',
    paramSize: '3.2B',
    description: 'Fast, lightweight, native function calling. Ideal for most modern laptops and PCs.',
    command: 'ollama run llama3.2',
    vram: '~2.2 GB',
  },
  {
    name: 'Qwen 2.5',
    tag: 'qwen2.5:7b',
    paramSize: '7B',
    description: 'Exceptional reasoning and structured tool parameter generation.',
    command: 'ollama run qwen2.5:7b',
    vram: '~4.5 GB',
  },
  {
    name: 'Mistral 7B',
    tag: 'mistral',
    paramSize: '7B',
    description: 'Balanced network diagnostics and concise technical explanations.',
    command: 'ollama run mistral',
    vram: '~4.2 GB',
  },
  {
    name: 'Phi-3 Mini',
    tag: 'phi3',
    paramSize: '3.8B',
    description: 'Ultra-lightweight model for lower-spec PCs and integrated graphics.',
    command: 'ollama run phi3',
    vram: '~2.4 GB',
  },
];

export const NETX_AI_SYSTEM_PROMPT = `You are NetX AI, an expert Windows desktop network telemetry and diagnostics assistant.
You help users monitor, test, diagnose, troubleshoot, and optimize their internet and LAN connections.
You have direct access to NetX's verified Windows networking services via tool calls.

Core Operating Principles:
1. When a user asks you to inspect, test, measure, ping, scan, or diagnose, ALWAYS call the corresponding tool.
2. NEVER fabricate, estimate, or simulate speed test numbers, ping latencies, or diagnostic results. All metrics must come directly from real tool execution.
3. Ground your explanations in the actual measured output returned by the tools.
4. When diagnosing problems, state the likely fault domain (e.g. Local Adapter, Local Router/Gateway, DNS Resolver, WAN/ISP) and your confidence level based on facts.
5. If an operation could disrupt active connections (e.g. renewing DHCP or disconnecting Wi-Fi), clearly explain the impact.
6. NEVER ask for or echo Wi-Fi passwords. NetX prompts users securely via dedicated UI modals.
7. Be concise, professional, and practical. Use bullet points or short structured summaries.`;

export async function checkOllamaConnection(url: string = 'http://127.0.0.1:11434'): Promise<{
  online: boolean;
  version?: string;
  models: OllamaModelInfo[];
  error?: string;
}> {
  if (typeof window !== 'undefined' && window.netxNative?.getOllamaStatus) {
    try {
      const res = await window.netxNative.getOllamaStatus(url);
      return res;
    } catch (err: any) {
      return { online: false, models: [], error: err?.message || String(err) };
    }
  }

  // Browser dev fallback
  try {
    const cleanUrl = url.replace(/\/+$/, '');
    const [tagsRes, verRes] = await Promise.all([
      fetch(`${cleanUrl}/api/tags`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${cleanUrl}/api/version`, { signal: AbortSignal.timeout(3000) }),
    ]);
    if (!tagsRes.ok) throw new Error(`HTTP ${tagsRes.status}`);
    const tags = await tagsRes.json();
    const ver = verRes.ok ? await verRes.json() : { version: 'unknown' };
    return {
      online: true,
      version: ver.version,
      models: tags.models || [],
    };
  } catch (err: any) {
    return {
      online: false,
      models: [],
      error: err?.message || 'Ollama offline',
    };
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: any;
    };
  }>;
}

export async function sendOllamaChat(
  url: string,
  model: string,
  messages: ChatMessage[],
  temperature: number = 0.4
): Promise<{
  ok: boolean;
  message?: ChatMessage;
  error?: string;
}> {
  const tools = getOllamaToolsSchema();
  const cleanUrl = (url || 'http://127.0.0.1:11434').replace(/\/+$/, '');

  if (typeof window !== 'undefined' && window.netxNative?.chatOllama) {
    try {
      const res = await window.netxNative.chatOllama({
        url: cleanUrl,
        model,
        messages,
        tools,
        options: { temperature },
      });
      if (res.ok && res.message) {
        return { ok: true, message: res.message };
      }
      return { ok: false, error: res.error || 'No message received from Ollama' };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  // Fallback direct fetch
  try {
    const res = await fetch(`${cleanUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        tools,
        stream: false,
        options: { temperature },
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    }
    const data = await res.json();
    return { ok: true, message: data.message };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Checks if a text response contains an embedded JSON tool call for models that
 * do not support native Ollama tool_calls.
 */
export function extractFallbackJsonToolCall(text: string): { name: string; args: any } | null {
  if (!text) return null;
  // Match {"tool": "name", "args": {...}} or {"function": "name", "arguments": {...}}
  const regex = /\{[\s\r\n]*"(?:tool|function|action)"[\s\r\n]*:[\s\r\n]*"([^"]+)"[\s\r\n]*,[\s\r\n]*"(?:args|arguments|parameters)"[\s\r\n]*:[\s\r\n]*(\{[^}]*\})[\s\r\n]*\}/i;
  const match = text.match(regex);
  if (match) {
    try {
      const name = match[1];
      const args = JSON.parse(match[2]);
      if (findToolByName(name)) {
        return { name, args };
      }
    } catch {
      // ignore parse error
    }
  }
  return null;
}
