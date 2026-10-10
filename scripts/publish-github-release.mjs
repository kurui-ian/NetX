import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function getGithubToken() {
  const out = execSync('git credential fill', {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
  });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('Could not retrieve GitHub token from git credential fill');
  return m[1].trim();
}

const RELEASE_BODY = `## NetX — V 1.0.0 (Windows x64 Desktop Release)

NetX is a modern, native Windows desktop network utility & telemetry suite designed to be **simple for beginners and useful for advanced users**.

### ✨ Highlights in V 1.0.0

* **Real-Time Network Overview & Dashboard**:
  * Live **Download Mbps**, **Upload Mbps**, **Ping (ms)**, and **Jitter (ms)** measured directly from your Windows network adapter counters (\`GetIPStatistics\` & \`netstat -e\`).
  * Interactive **4-Hop Connection Topology** (*Adapter → Local Gateway → DNS Resolver → Internet*) with live per-hop ICMP latency.
  * Smooth dual-series **Real-Time Bandwidth Activity Graph** with hover inspection and Pause/Resume controls.
* **Live Internet Speed Test**:
  * Multi-stage benchmark (*Ping/Jitter → HTTPS Download → HTTPS Upload*) against Cloudflare Edge servers with persistent local history.
* **Persistent Data Usage Tracking**:
  * Tracks downloaded and uploaded bytes across **Day** (hourly), **Week** (daily), and **Month** views stored locally in \`%APPDATA%\\NetX\\netx-usage-store.json\`.
* **Applications & Active Socket Inspector**:
  * Live Windows process bandwidth table and \`netstat -ano\` TCP/UDP endpoint inspector with reverse-DNS hostname lookup.
* **Wi-Fi Environment & Local LAN Scanner**:
  * Real-time \`netsh wlan\` spectrum scanner (SSID, BSSID, Channel, Band, Signal %, dBm, WPA2/WPA3 cipher) and ARP/ICMP subnet device discovery.
* **Interactive Network Tools & Guided Diagnostics**:
  * Built-in **Ping**, **Traceroute**, **DNS Lookup** (\`A\`, \`AAAA\`, \`MX\`, \`NS\`, \`TXT\`), **TCP Port Check**, and a 4-stage guided **Network Diagnostics** runner.
* **Appearance Modes & System Tray**:
  * Full **Light**, **Dark**, and **System (Auto)** theme support that follows Windows OS theme changes automatically, plus a native Windows System Tray icon and quick menu.

---

### 📦 Installation / Running

1. Download **\`NetX-v1.0.0-win32-x64.zip\`** from the Assets section below.
2. Extract the archive and run **\`NetX.exe\`**.
`;

async function main() {
  const token = getGithubToken();
  const owner = 'kurui-ian';
  const repo = 'NetX';
  const tag = 'v1.0.0';

  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'NetX-Release-Publisher',
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  let release;
  // Check if release for v1.0.0 already exists
  const checkRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
    { headers }
  );

  if (checkRes.ok) {
    release = await checkRes.json();
    console.log(`Found existing release ID ${release.id}, updating...`);
    const updateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          tag_name: tag,
          name: 'V 1.0.0',
          body: RELEASE_BODY,
          draft: false,
          prerelease: false,
        }),
      }
    );
    release = await updateRes.json();
  } else {
    console.log('Creating new GitHub Release V 1.0.0...');
    const createRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tag_name: tag,
          target_commitish: 'main',
          name: 'V 1.0.0',
          body: RELEASE_BODY,
          draft: false,
          prerelease: false,
        }),
      }
    );
    if (!createRes.ok) {
      throw new Error(`Failed to create release: ${createRes.status} ${await createRes.text()}`);
    }
    release = await createRes.json();
  }

  console.log(`Release V 1.0.0 ready at: ${release.html_url}`);

  // Upload assets
  const assetsToUpload = [
    {
      filePath: path.join(rootDir, 'release', 'NetX-v1.0.0-win32-x64.zip'),
      name: 'NetX-v1.0.0-win32-x64.zip',
      contentType: 'application/zip',
    },
    {
      filePath: path.join(rootDir, 'release', 'SHA256SUMS.txt'),
      name: 'SHA256SUMS.txt',
      contentType: 'text/plain',
    },
  ];

  const uploadBaseUrl = release.upload_url.replace(/\{\?name,label\}$/, '');

  for (const asset of assetsToUpload) {
    if (!fs.existsSync(asset.filePath)) continue;

    // Delete existing asset with same name if present
    const existing = (release.assets || []).find((a) => a.name === asset.name);
    if (existing) {
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases/assets/${existing.id}`,
        { method: 'DELETE', headers }
      );
    }

    const fileBuffer = fs.readFileSync(asset.filePath);
    console.log(
      `Uploading ${asset.name} (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`
    );

    const upRes = await fetch(
      `${uploadBaseUrl}?name=${encodeURIComponent(asset.name)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'NetX-Release-Publisher',
          Accept: 'application/vnd.github+json',
          'Content-Type': asset.contentType,
          'Content-Length': String(fileBuffer.length),
        },
        body: fileBuffer,
      }
    );

    if (!upRes.ok) {
      console.error(`Warning uploading ${asset.name}: ${upRes.status} ${await upRes.text()}`);
    } else {
      const upJson = await upRes.json();
      console.log(`Uploaded ${asset.name} -> ${upJson.browser_download_url}`);
    }
  }

  console.log(`SUCCESS: GitHub Release published at ${release.html_url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
