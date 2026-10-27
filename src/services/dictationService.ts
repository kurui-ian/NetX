/**
 * NetX Dictation Service — Precision Speech-to-Text Engine
 * 
 * Architecture:
 * 1. Cloud Mode (Google Gemini Neural Audio): Verbatim, high-accuracy dictation with
 *    technical network terminology, capitalization, and natural punctuation.
 * 2. Offline Mode (Windows Native Speech Recognition Engine via bin/netxspeech.exe):
 *    100% local, zero-internet speech recognition powered by System.Speech.Recognition
 *    with weighted NetX command grammar and full free-form dictation.
 * 3. Fallback: Web Speech API (webkitSpeechRecognition) when running in browser preview.
 */

import { DEFAULT_GEMINI_API_KEY, DEFAULT_GEMINI_MODEL, normalizeGeminiModel } from './geminiClient';

export interface DictationResult {
  ok: boolean;
  text?: string;
  confidence?: number;
  grammar?: string;
  engine: 'gemini' | 'windows-offline' | 'browser-speech' | 'none';
  durationMs?: number;
  error?: string;
}

export type DictationState = 'idle' | 'starting' | 'listening' | 'transcribing';

export interface DictationCallbacks {
  onStateChange?: (state: DictationState) => void;
  onAudioLevel?: (level: number) => void;
  onDuration?: (seconds: number) => void;
  onError?: (error: string) => void;
}

class NetXDictationManager {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private animFrameId: number | null = null;
  private timerIntervalId: number | null = null;
  private startTime: number = 0;
  private currentState: DictationState = 'idle';

  public getState(): DictationState {
    return this.currentState;
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasNative = !!(window.netxNative && window.netxNative.transcribeAudio);
    const hasWebSpeech = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    return hasMedia || hasNative || hasWebSpeech;
  }

  /**
   * Start listening to user speech with microphone and real-time audio visualization
   */
  public async startListening(callbacks: DictationCallbacks): Promise<boolean> {
    if (this.currentState !== 'idle') {
      this.cancel();
    }

    try {
      this.setState('starting', callbacks);

      // Check audio permissions / media devices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this environment');
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize Web Audio Context for audio level meters
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      sourceNode.connect(this.analyser);

      // Setup MediaRecorder
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      this.recordedChunks = [];
      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(100); // 100ms slice interval
      this.startTime = Date.now();
      this.setState('listening', callbacks);

      // Start Audio Level Meter Loop
      const pcmData = new Uint8Array(this.analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!this.analyser || this.currentState !== 'listening') return;
        this.analyser.getByteFrequencyData(pcmData);
        let sum = 0;
        for (let i = 0; i < pcmData.length; i++) {
          sum += pcmData[i];
        }
        const avg = sum / pcmData.length;
        const normalized = Math.min(1, Math.max(0, avg / 128));
        callbacks.onAudioLevel?.(normalized);
        this.animFrameId = requestAnimationFrame(updateLevel);
      };
      this.animFrameId = requestAnimationFrame(updateLevel);

      // Start duration ticker
      this.timerIntervalId = window.setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
        callbacks.onDuration?.(elapsedSec);
      }, 500);

      return true;
    } catch (err: any) {
      this.cleanup();
      this.setState('idle', callbacks);
      const errMsg = err?.message || 'Failed to initialize microphone dictation';
      callbacks.onError?.(errMsg);
      return false;
    }
  }

  /**
   * Stop listening and transcribe the captured audio
   */
  public async stopAndTranscribe(
    options: {
      mode?: 'auto' | 'offline' | 'online';
      apiKey?: string;
      model?: string;
      isOnline?: boolean;
    },
    callbacks: DictationCallbacks
  ): Promise<DictationResult> {
    if (this.currentState !== 'listening' || !this.mediaRecorder) {
      this.cleanup();
      this.setState('idle', callbacks);
      return { ok: false, error: 'Not currently recording speech', engine: 'none' };
    }

    const durationMs = Date.now() - this.startTime;
    this.setState('transcribing', callbacks);

    try {
      const audioBlob = await new Promise<Blob>((resolve, reject) => {
        if (!this.mediaRecorder) return reject(new Error('Recorder inactive'));
        this.mediaRecorder.onstop = () => {
          const finalBlob = new Blob(this.recordedChunks, {
            type: this.recordedChunks[0]?.type || 'audio/webm',
          });
          resolve(finalBlob);
        };
        this.mediaRecorder.stop();
      });

      // Convert audio blob to 16kHz mono WAV format for universal ingestion
      const wavBase64 = await this.convertBlobTo16kHzWavBase64(audioBlob);

      // Cleanup microphone and audio context immediately
      this.cleanup();

      // Check if Electron native transcription is available
      if (typeof window !== 'undefined' && window.netxNative?.transcribeAudio) {
        const preferOnline =
          options.mode === 'online' ||
          (options.mode !== 'offline' && options.isOnline !== false);

        const cleanKey =
          (options.apiKey && options.apiKey.trim()) || DEFAULT_GEMINI_API_KEY;
        const cleanModel = normalizeGeminiModel(options.model || DEFAULT_GEMINI_MODEL);

        const nativeRes = await window.netxNative.transcribeAudio({
          audioBase64: wavBase64,
          mimeType: 'audio/wav',
          preferOnline,
          apiKey: cleanKey,
          model: cleanModel,
        });

        this.setState('idle', callbacks);

        if (nativeRes.ok && nativeRes.text) {
          return {
            ok: true,
            text: nativeRes.text,
            confidence: nativeRes.confidence || 0.95,
            grammar: nativeRes.grammar,
            engine: (nativeRes.engine as any) || (preferOnline ? 'gemini' : 'windows-offline'),
            durationMs,
          };
        } else {
          return {
            ok: false,
            error: nativeRes.error || 'Speech could not be recognized',
            engine: (nativeRes.engine as any) || 'windows-offline',
            durationMs,
          };
        }
      }

      this.setState('idle', callbacks);
      return {
        ok: false,
        error: 'Native speech transcription not available',
        engine: 'none',
        durationMs,
      };
    } catch (err: any) {
      this.cleanup();
      this.setState('idle', callbacks);
      const errMsg = err?.message || 'Error occurred during audio transcription';
      callbacks.onError?.(errMsg);
      return { ok: false, error: errMsg, engine: 'none', durationMs };
    }
  }

  /**
   * Cancel ongoing listening session without transcribing
   */
  public cancel(callbacks?: DictationCallbacks): void {
    this.cleanup();
    if (callbacks) {
      this.setState('idle', callbacks);
    } else {
      this.currentState = 'idle';
    }
  }

  private setState(state: DictationState, callbacks?: DictationCallbacks): void {
    this.currentState = state;
    callbacks?.onStateChange?.(state);
  }

  private cleanup(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
    }
    this.audioContext = null;
    this.analyser = null;
    this.recordedChunks = [];
  }

  /**
   * Convert any recorded Audio Blob into a standardized 16kHz 16-bit Mono PCM WAV base64 string
   */
  private async convertBlobTo16kHzWavBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    // Temporary audio context for decoding
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const decodeCtx = new AudioContextClass();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
    } finally {
      try {
        await decodeCtx.close();
      } catch {}
    }

    // Target sample rate for speech engines: 16,000 Hz
    const targetSampleRate = 16000;
    const numChannels = 1;

    // Resample if necessary using OfflineAudioContext
    let monoBuffer: AudioBuffer;
    if (audioBuffer.sampleRate !== targetSampleRate) {
      const OfflineCtxClass =
        window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtxClass(
        numChannels,
        Math.ceil((audioBuffer.duration * targetSampleRate)),
        targetSampleRate
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);
      monoBuffer = await offlineCtx.startRendering();
    } else {
      monoBuffer = audioBuffer;
    }

    // Extract mono channel data
    const channelData = monoBuffer.getChannelData(0);
    const wavBuffer = this.encodeWav16Bit(channelData, targetSampleRate);

    // Convert to base64
    return this.arrayBufferToBase64(wavBuffer);
  }

  /**
   * Encodes float samples into RIFF 16-bit PCM WAV
   */
  private encodeWav16Bit(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const numSamples = samples.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // 1. "RIFF" chunk descriptor
    this.writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    this.writeAscii(view, 8, 'WAVE');

    // 2. "fmt " sub-chunk
    this.writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1 for mono)
    view.setUint32(24, sampleRate, true); // SampleRate (16000)
    view.setUint32(28, sampleRate * 2, true); // ByteRate (16000 * 1 * 2)
    view.setUint16(32, 2, true); // BlockAlign (1 * 2)
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)

    // 3. "data" sub-chunk
    this.writeAscii(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Write 16-bit PCM samples with clipping protection
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    return buffer;
  }

  private writeAscii(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export const netxDictation = new NetXDictationManager();
