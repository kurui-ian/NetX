/**
 * NetX Voice Dictation & Speech Engine Test Suite
 * Verifies:
 * 1. Native Windows Speech Recognizer status & engine registration
 * 2. 100% Offline WAV file transcription
 * 3. Network domain grammar prioritization & confidence
 * 4. Punctuation, capitalization, and technical acronym normalization
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n--- 1. Testing Native Speech Engine Binary ---');
const exePath = path.join(process.cwd(), 'bin', 'netxspeech.exe');
assert(fs.existsSync(exePath), `Binary exists at ${exePath}`);

const checkOutput = execSync(`"${exePath}" --check`, { encoding: 'utf8' });
const checkJson = JSON.parse(checkOutput.trim());
assert(checkJson.ok === true, 'Engine check returns ok: true');
assert(checkJson.count >= 1, `Found ${checkJson.count} installed Windows speech recognizer(s)`);
assert(checkJson.engines[0]?.name.includes('Microsoft Speech Recognizer'), 'Windows Speech Recognizer registered');

console.log('\n--- 2. Testing 100% Offline Speech-to-Text Transcription ---');
const tempWav = path.join(process.env.TEMP || '.', `test_dictation_${Date.now()}.wav`);

try {
  // Synthesize network command phrase to WAV using Windows SAPI
  const testPhrase = 'run speed test';
  execSync(
    `powershell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${tempWav}'); $s.Speak('${testPhrase}'); $s.Dispose()"`,
    { encoding: 'utf8' }
  );

  assert(fs.existsSync(tempWav), `Synthesized test WAV at ${tempWav}`);
  assert(fs.statSync(tempWav).size > 1000, 'Audio WAV file has valid non-empty byte stream');

  // Transcribe offline using netxspeech.exe
  const transcribeOutput = execSync(`"${exePath}" --file "${tempWav}"`, { encoding: 'utf8' });
  const result = JSON.parse(transcribeOutput.trim());

  assert(result.ok === true, 'Offline transcription succeeded');
  assert(
    result.text.toLowerCase().includes('run') && result.text.toLowerCase().includes('speed test'),
    `Recognized command: "${result.text}"`
  );
  assert(result.confidence > 0.7, `High recognition confidence: ${result.confidence}`);
  assert(result.engine === 'windows-native-file', 'Engine identified as windows-native-file');
} finally {
  if (fs.existsSync(tempWav)) {
    fs.unlinkSync(tempWav);
  }
}

console.log('\n--- 3. Testing Acronym and Punctuation Formatting ---');
const testQuestionWav = path.join(process.env.TEMP || '.', `test_dictation_q_${Date.now()}.wav`);
try {
  const questionPhrase = 'what is my ip address';
  execSync(
    `powershell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${testQuestionWav}'); $s.Speak('${questionPhrase}'); $s.Dispose()"`,
    { encoding: 'utf8' }
  );

  const qOutput = execSync(`"${exePath}" --file "${testQuestionWav}"`, { encoding: 'utf8' });
  const qResult = JSON.parse(qOutput.trim());

  assert(qResult.ok === true, 'Question transcription succeeded');
  assert(qResult.text.includes('IP'), 'Correctly capitalized "IP" acronym in transcribed text');
  assert(qResult.text.endsWith('?'), 'Correctly auto-appended "?" to question sentence');
  console.log(`Formatted output: "${qResult.text}"`);
} finally {
  if (fs.existsSync(testQuestionWav)) {
    fs.unlinkSync(testQuestionWav);
  }
}

console.log('\n🎉 ALL DICTATION TEST SUITES PASSED!\n');
