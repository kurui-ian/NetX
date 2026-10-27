using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Speech.Recognition;

namespace NetXSpeech {
    class Program {
        static int Main(string[] args) {
            if (args.Length == 0) {
                PrintJsonError("No arguments provided. Usage: netxspeech.exe --file <wavPath> or netxspeech.exe --listen <seconds>");
                return 1;
            }

            string mode = args[0].ToLowerInvariant();
            if (mode == "--file" && args.Length >= 2) {
                string wavPath = args[1];
                return TranscribeFile(wavPath);
            } else if (mode == "--listen") {
                int timeoutSec = 6;
                int parsedSec;
                if (args.Length >= 2 && int.TryParse(args[1], out parsedSec)) {
                    timeoutSec = parsedSec;
                }
                return TranscribeMicrophone(timeoutSec);
            } else if (mode == "--check") {
                return CheckEngines();
            } else {
                PrintJsonError("Unknown arguments. Usage: netxspeech.exe --file <wavPath> or --listen <seconds>");
                return 1;
            }
        }

        static int CheckEngines() {
            try {
                var recognizers = SpeechRecognitionEngine.InstalledRecognizers();
                Console.WriteLine("{\"ok\":true,\"count\":" + recognizers.Count + ",\"engines\":[");
                for (int i = 0; i < recognizers.Count; i++) {
                    var r = recognizers[i];
                    string comma = (i < recognizers.Count - 1) ? "," : "";
                    Console.WriteLine(string.Format("{{\"id\":\"{0}\",\"name\":\"{1}\",\"culture\":\"{2}\"}}{3}",
                        EscapeJson(r.Id), EscapeJson(r.Description), EscapeJson(r.Culture.Name), comma));
                }
                Console.WriteLine("]}");
                return 0;
            } catch (Exception ex) {
                PrintJsonError("CheckEngines error: " + ex.Message);
                return 1;
            }
        }

        static int TranscribeFile(string wavPath) {
            if (!File.Exists(wavPath)) {
                PrintJsonError("Audio file does not exist: " + wavPath);
                return 2;
            }

            try {
                using (var engine = CreateSpeechEngine()) {
                    engine.SetInputToWaveFile(wavPath);
                    // Recognize audio (timeout up to 30 seconds for long dictations)
                    RecognitionResult result = engine.Recognize(TimeSpan.FromSeconds(30));
                    return OutputRecognitionResult(result, "windows-native-file");
                }
            } catch (Exception ex) {
                PrintJsonError("TranscribeFile error: " + ex.Message);
                return 3;
            }
        }

        static int TranscribeMicrophone(int timeoutSec) {
            try {
                using (var engine = CreateSpeechEngine()) {
                    engine.SetInputToDefaultAudioDevice();
                    Console.Error.WriteLine("NETX_LISTENING");
                    RecognitionResult result = engine.Recognize(TimeSpan.FromSeconds(timeoutSec));
                    return OutputRecognitionResult(result, "windows-native-mic");
                }
            } catch (Exception ex) {
                PrintJsonError("TranscribeMicrophone error: " + ex.Message);
                return 4;
            }
        }

        static SpeechRecognitionEngine CreateSpeechEngine() {
            var engine = new SpeechRecognitionEngine();

            // 1. Domain-specific NetX network command vocabulary (high priority)
            try {
                var choices = new Choices(new string[] {
                    "run speed test",
                    "run a speed test",
                    "test internet speed",
                    "speed test",
                    "check connection",
                    "check network connection",
                    "how is my connection",
                    "diagnose network",
                    "run diagnostics",
                    "is my internet working",
                    "why is my internet slow",
                    "ping google",
                    "ping google.com",
                    "ping default gateway",
                    "ping gateway",
                    "ping cloudflare",
                    "traceroute google.com",
                    "trace route to google",
                    "scan wifi networks",
                    "show wifi networks",
                    "list wifi networks",
                    "check available wifi",
                    "connect to wifi",
                    "disconnect wifi",
                    "disconnect from wifi",
                    "what is my ip",
                    "what is my ip address",
                    "show my ip",
                    "show connection details",
                    "show network details",
                    "flush dns",
                    "flush dns cache",
                    "clear dns cache",
                    "renew dhcp",
                    "renew ip address",
                    "how is my latency",
                    "check packet loss",
                    "show data usage",
                    "show gaming mode",
                    "open settings",
                    "check port",
                    "test port",
                    "dns lookup",
                    "hello",
                    "hi",
                    "hey",
                    "help me"
                });

                var netBuilder = new GrammarBuilder(choices);
                var netGrammar = new Grammar(netBuilder);
                netGrammar.Name = "NetXCommands";
                netGrammar.Weight = 1.0f;
                engine.LoadGrammar(netGrammar);
            } catch {
                // If specific choices fail, continue to dictation
            }

            // 2. Open-ended Dictation Grammar for arbitrary free-form speech
            try {
                var dictation = new DictationGrammar();
                dictation.Name = "FreeDictation";
                dictation.Weight = 0.6f;
                engine.LoadGrammar(dictation);
            } catch {
                // Fallback
            }

            return engine;
        }

        static int OutputRecognitionResult(RecognitionResult result, string source) {
            if (result == null || string.IsNullOrWhiteSpace(result.Text)) {
                Console.WriteLine("{\"ok\":false,\"error\":\"No speech could be recognized\",\"code\":\"NO_SPEECH\"}");
                return 0;
            }

            string clean = CleanPunctuation(result.Text);
            float confidence = result.Confidence;
            string grammar = result.Grammar != null ? result.Grammar.Name : "Unknown";

            Console.WriteLine(string.Format("{{\"ok\":true,\"text\":\"{0}\",\"confidence\":{1:F2},\"grammar\":\"{2}\",\"engine\":\"{3}\"}}",
                EscapeJson(clean), confidence, EscapeJson(grammar), EscapeJson(source)));
            return 0;
        }

        static string CleanPunctuation(string text) {
            if (string.IsNullOrWhiteSpace(text)) return "";
            string trimmed = text.Trim();

            // Capitalize first character
            if (trimmed.Length > 0 && char.IsLower(trimmed[0])) {
                trimmed = char.ToUpper(trimmed[0]) + (trimmed.Length > 1 ? trimmed.Substring(1) : "");
            }

            // Fix network acronyms capitalization
            trimmed = ReplaceWord(trimmed, "ip", "IP");
            trimmed = ReplaceWord(trimmed, "dns", "DNS");
            trimmed = ReplaceWord(trimmed, "dhcp", "DHCP");
            trimmed = ReplaceWord(trimmed, "wifi", "Wi-Fi");
            trimmed = ReplaceWord(trimmed, "wi-fi", "Wi-Fi");
            trimmed = ReplaceWord(trimmed, "ssid", "SSID");
            trimmed = ReplaceWord(trimmed, "lan", "LAN");
            trimmed = ReplaceWord(trimmed, "wan", "WAN");
            trimmed = ReplaceWord(trimmed, "mbps", "Mbps");
            trimmed = ReplaceWord(trimmed, "gbps", "Gbps");

            // Add trailing punctuation if missing
            char last = trimmed[trimmed.Length - 1];
            if (last != '.' && last != '?' && last != '!') {
                string lower = trimmed.ToLowerInvariant();
                if (lower.StartsWith("what") || lower.StartsWith("why") || lower.StartsWith("how") ||
                    lower.StartsWith("is") || lower.StartsWith("can") || lower.StartsWith("could") ||
                    lower.StartsWith("are") || lower.StartsWith("where") || lower.StartsWith("who")) {
                    trimmed += "?";
                } else {
                    trimmed += ".";
                }
            }

            return trimmed;
        }

        static string ReplaceWord(string input, string word, string replacement) {
            string pattern = @"\b" + System.Text.RegularExpressions.Regex.Escape(word) + @"\b";
            return System.Text.RegularExpressions.Regex.Replace(input, pattern, replacement, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        }

        static void PrintJsonError(string message) {
            Console.WriteLine("{\"ok\":false,\"error\":\"" + EscapeJson(message) + "\"}");
        }

        static string EscapeJson(string s) {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "\\n");
        }
    }
}
