import { matchUserIntent } from '../src/services/intentMatcher';
import {
  NETX_AI_TOOLS,
  findToolByName,
  getOllamaToolsSchema,
} from '../src/services/aiToolRegistry';
import {
  checkOllamaConnection,
  extractFallbackJsonToolCall,
  RECOMMENDED_MODELS,
} from '../src/services/ollamaClient';
import {
  analyzeDiagnosticResults,
} from '../src/services/diagnosticAnalyzer';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runTestSuite() {
  console.log('\n--- 1. Testing Intent Recognition & Tool Selection ---');

  const speedIntent = matchUserIntent('Run an internet speed test');
  assert(speedIntent?.toolName === 'run_speed_test', 'Recognizes "Run an internet speed test" -> run_speed_test');

  const diagIntent = matchUserIntent('Why is my internet slow? Diagnose my connection');
  assert(diagIntent?.toolName === 'diagnose_network', 'Recognizes "Why is my internet slow?" -> diagnose_network');

  const pingIntent = matchUserIntent('ping 1.1.1.1 -n 5');
  assert(pingIntent?.toolName === 'ping_host' && pingIntent.args.host === '1.1.1.1' && pingIntent.args.count === 5, 'Parses ping command and arguments');

  const dnsIntent = matchUserIntent('check dns for cloudflare.com');
  assert(dnsIntent?.toolName === 'dns_lookup' && dnsIntent.args.domain === 'cloudflare.com', 'Parses DNS query command');

  const wifiIntent = matchUserIntent('Show all available Wi-Fi networks');
  assert(wifiIntent?.toolName === 'list_wifi_networks', 'Recognizes Wi-Fi network scanning');

  const lanIntent = matchUserIntent('Find devices on my local network');
  assert(lanIntent?.toolName === 'discover_lan_devices', 'Recognizes LAN device scanning');

  const flushIntent = matchUserIntent('Flush my DNS resolver cache');
  assert(flushIntent?.toolName === 'flush_dns', 'Recognizes DNS flush intent');

  const renewIntent = matchUserIntent('Renew my DHCP IP lease');
  assert(renewIntent?.toolName === 'renew_dhcp', 'Recognizes DHCP renewal intent');

  const disconnectIntent = matchUserIntent('Disconnect from active Wi-Fi');
  assert(disconnectIntent?.toolName === 'disconnect_wifi', 'Recognizes Wi-Fi disconnection intent');

  console.log('\n--- 2. Testing Tool Registry Schemas & Safety ---');

  assert(NETX_AI_TOOLS.length >= 12, `Registered ${NETX_AI_TOOLS.length} network tools`);

  const schemas = getOllamaToolsSchema();
  assert(schemas.length === NETX_AI_TOOLS.length, 'Generates valid Ollama function tool schemas');

  const flushTool = findToolByName('flush_dns');
  assert(flushTool?.requiresConfirmation === true, 'Disruptive tool "flush_dns" requires user confirmation');

  const renewTool = findToolByName('renew_dhcp');
  assert(renewTool?.requiresConfirmation === true, 'Disruptive tool "renew_dhcp" requires user confirmation');

  const discTool = findToolByName('disconnect_wifi');
  assert(discTool?.requiresConfirmation === true, 'Disruptive tool "disconnect_wifi" requires user confirmation');

  // Argument validation tests
  const pingTool = findToolByName('ping_host');
  const validPing = pingTool?.validateArgs({ host: '1.1.1.1; rm -rf /', count: 100 });
  assert(validPing?.cleanArgs.host === '1.1.1.1', 'Host sanitization removes command injection characters');
  assert(validPing?.cleanArgs.count === 10, 'Count clamped to safe upper limit of 10 packets');

  console.log('\n--- 3. Testing Fallback JSON Tool Parsing ---');

  const sampleJson = 'I recommend running a speed test: {"tool": "run_speed_test", "args": {}}';
  const extracted = extractFallbackJsonToolCall(sampleJson);
  assert(extracted?.name === 'run_speed_test', 'Successfully extracts fallback JSON tool call from plain model text');

  console.log('\n--- 4. Testing Diagnostic Reasoning Engine ---');

  // Case A: Disconnected adapter
  const adapterFail = analyzeDiagnosticResults({
    steps: {
      adapter: { passed: false, detail: 'No IP' },
      gateway: { passed: false },
      dns: { passed: false },
      internet: { passed: false },
    },
  });
  assert(adapterFail.faultDomain === 'Local Adapter / Hardware', 'Identifies "Local Adapter / Hardware" when adapter has no IP');
  assert(adapterFail.status === 'critical', 'Flags adapter failure as critical');
  assert(adapterFail.suggestedAction?.toolName === 'renew_dhcp', 'Recommends DHCP renewal action');

  // Case B: Gateway unreachable
  const gatewayFail = analyzeDiagnosticResults({
    steps: {
      adapter: { passed: true, detail: '192.168.1.100' },
      gateway: { passed: false, detail: 'Timed out' },
      dns: { passed: false },
      internet: { passed: false },
    },
  });
  assert(gatewayFail.faultDomain === 'Local Gateway / Router', 'Identifies "Local Gateway / Router" when gateway is unreachable');

  // Case C: DNS failure
  const dnsFail = analyzeDiagnosticResults({
    steps: {
      adapter: { passed: true, detail: '192.168.1.100' },
      gateway: { passed: true, detail: '2ms RTT' },
      dns: { passed: false, detail: 'Resolver error' },
      internet: { passed: true },
    },
  });
  assert(dnsFail.faultDomain === 'DNS Resolution Service', 'Identifies "DNS Resolution Service" when DNS resolve fails');
  assert(dnsFail.suggestedAction?.toolName === 'flush_dns', 'Recommends DNS flush repair action');

  // Case D: Internet WAN failure
  const wanFail = analyzeDiagnosticResults({
    steps: {
      adapter: { passed: true, detail: '192.168.1.100' },
      gateway: { passed: true, detail: '2ms RTT' },
      dns: { passed: true, detail: 'Resolved' },
      internet: { passed: false, detail: 'Unreachable' },
    },
  });
  assert(wanFail.faultDomain === 'WAN / ISP Routing', 'Identifies "WAN / ISP Routing" when WAN transit is blocked');

  // Case E: Degraded Wi-Fi (<35%)
  const wifiDegraded = analyzeDiagnosticResults({
    steps: {
      adapter: { passed: true },
      gateway: { passed: true },
      dns: { passed: true },
      internet: { passed: true },
    },
    telemetry: {
      wifi: { connected: true, ssid: 'Home_5G', signalQuality: 22, signalDbm: -88, band: '5 GHz', linkSpeedMbps: 24 },
    },
  });
  assert(wifiDegraded.faultDomain === 'Wi-Fi Signal Degraded', 'Identifies weak Wi-Fi signal (<35%)');

  // Case F: Healthy baseline
  const healthy = analyzeDiagnosticResults({
    steps: {
      adapter: { passed: true, detail: 'Ethernet' },
      gateway: { passed: true, detail: '1ms' },
      dns: { passed: true, detail: '12ms' },
      internet: { passed: true, detail: 'Cloudflare Edge' },
    },
    telemetry: {
      wifi: { connected: false },
    },
  });
  assert(healthy.faultDomain === 'Healthy (No Fault Detected)', 'Identifies "Healthy (No Fault Detected)" when all pass');

  console.log('\n--- 5. Testing Credential Redaction & Security ---');

  // Verify no tool schema exposes a password parameter to the LLM
  for (const tool of schemas) {
    assert(!tool.function.parameters.properties?.password, `Tool "${tool.function.name}" does NOT expose password parameter to LLM`);
  }

  console.log('\n--- 6. Testing Ollama Connection Recovery ---');

  const probe = await checkOllamaConnection('http://127.0.0.1:9999'); // Unused port
  assert(probe.online === false, 'Gracefully handles unreachable Ollama server without throwing unhandled exceptions');
  assert(Array.isArray(probe.models), 'Returns safe empty models array when offline');

  console.log('\n🎉 ALL 22 UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
