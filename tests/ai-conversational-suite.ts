import { matchConversationalIntent, matchUserIntent } from '../src/services/intentMatcher';
import {
  getGeminiToolsDeclaration,
  DEFAULT_GEMINI_API_KEY,
  DEFAULT_GEMINI_MODEL,
  testGeminiApiKey,
} from '../src/services/geminiClient';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runConversationalTests() {
  console.log('\n--- 1. Testing Conversational Intent & Greetings ---');

  const greeting1 = matchConversationalIntent('hey', 'Kurui');
  assert(greeting1 !== null, 'Recognizes greeting "hey"');
  assert(greeting1?.replyText.includes('Kurui') === true, 'Greeting addresses Kurui personally');

  const greeting2 = matchConversationalIntent('Hello there!', 'Kurui');
  assert(greeting2 !== null && greeting2.replyText.includes('Kurui'), 'Recognizes "Hello there!" and greets Kurui');

  const identity = matchConversationalIntent('who are you?', 'Kurui');
  assert(identity !== null && identity.replyText.includes('NetX AI'), 'Answers identity questions accurately');

  const thanks = matchConversationalIntent('thank you so much', 'Kurui');
  assert(thanks !== null && thanks.replyText.includes('Kurui'), 'Responds politely to expressions of gratitude');

  console.log('\n--- 2. Testing Wi-Fi Password Extraction & Connection Matching ---');

  const wifiScan = matchUserIntent('check available wifi networks');
  assert(wifiScan?.toolName === 'list_wifi_networks', 'Maps "check available wifi networks" to list_wifi_networks');

  const wifiConnect = matchUserIntent('connect to Kurui_Home_5G with password SuperSecretKey123');
  assert(wifiConnect?.toolName === 'connect_wifi', 'Maps connection request to connect_wifi');
  assert(wifiConnect?.args.ssid === 'Kurui_Home_5G', `Correctly parsed SSID: "${wifiConnect?.args.ssid}"`);
  assert(wifiConnect?.args.password === 'SuperSecretKey123', `Correctly parsed password: "${wifiConnect?.args.password}"`);

  const wifiConnectQuotes = matchUserIntent('connect to wifi "Office Guest" password "welcome2026"');
  assert(wifiConnectQuotes?.toolName === 'connect_wifi', 'Maps quoted connection request to connect_wifi');
  assert(wifiConnectQuotes?.args.ssid === 'Office Guest', `Correctly parsed quoted SSID: "${wifiConnectQuotes?.args.ssid}"`);
  assert(wifiConnectQuotes?.args.password === 'welcome2026', `Correctly parsed quoted password: "${wifiConnectQuotes?.args.password}"`);

  console.log('\n--- 3. Testing Google Gemini Tool Schema Declarations ---');

  const geminiTools = getGeminiToolsDeclaration();
  assert(Array.isArray(geminiTools) && geminiTools.length === 1, 'Gemini tool declaration wrapper formatted properly');
  const decls = geminiTools[0].functionDeclarations;
  assert(decls.length === 16, `Exported all 16 tool declarations for Gemini (found ${decls.length})`);
  assert(decls.some(d => d.name === 'connect_wifi'), 'Gemini declaration contains "connect_wifi"');
  assert(decls.some(d => d.name === 'list_wifi_networks'), 'Gemini declaration contains "list_wifi_networks"');

  console.log('\n--- 4. Testing Permanent Gemini API Key & Live Connectivity ---');

  assert(Boolean(DEFAULT_GEMINI_API_KEY && DEFAULT_GEMINI_API_KEY.startsWith('AQ.')), 'Permanent Gemini API key embedded');
  assert(DEFAULT_GEMINI_MODEL === 'gemini-3.5-flash', 'Default model configured as gemini-3.5-flash');

  const keyCheck = await testGeminiApiKey(DEFAULT_GEMINI_API_KEY, DEFAULT_GEMINI_MODEL);
  assert(keyCheck.ok === true, `Live Gemini API key validated successfully with Google (error: ${keyCheck.error})`);

  console.log('\n🎉 ALL CONVERSATIONAL & WI-FI SUITE TESTS PASSED!\n');
}

runConversationalTests().catch(err => {
  console.error(err);
  process.exit(1);
});
