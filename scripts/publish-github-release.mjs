import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

function getGithubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const out = execSync('git credential fill', {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
  });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('Could not retrieve GitHub token from git credential fill');
  return m[1].trim();
}

const RELEASE_BODY = `## NetX — Version 1.0.1 (Windows x64 Desktop Release)

NetX is a modern, reliable Windows desktop network utility & telemetry suite designed for both beginners and network engineers.

### 🚀 What's New in Version 1.0.1

* **Official Windows Installer (\`NetX-Setup-1.0.1.exe\`)**:
  * Packaged with NSIS installer supporting automatic Desktop and Start Menu shortcut creation.
  * Standard Windows Add/Remove Programs uninstaller support.
  * Packaged with high-resolution purple NetX brand icon.

* **Light Mode High-Contrast Overhaul**:
  * Completely revamped light mode styles with semantic CSS tokens (\`var(--text-primary)\`, \`var(--border-default)\`, etc.).
  * High contrast readability across all cards, topology nodes, metrics, process tables, modals, and the Quick Command Palette.

* **Minimalist Operations Dashboard**:
  * Streamlined layout removing placeholder search inputs and extra starter cards.
  * Focuses on live telemetry: real-time 60-second bandwidth waveform, 4-hop connection topology, hardware interface details, and active process bandwidth.

* **Smooth Speed Test Transitions**:
  * Added latency-locking interlude and visual staging transitions between the download and upload phases.
  * Clear locked speed badge (\`✓ Download Locked\`) and responsive status cues.

* **Sidebar & Emblem Layout Refinement**:
  * Eliminated emblem-badge overlap when collapsed; centered purple globe icon with dedicated collapse/expand toggle beneath.

---

### 📦 Downloads

* **Recommended**: **\`NetX-Setup-1.0.1.exe\`** — Standard Windows installer.
* **Portable (Optional)**: **\`NetX-v1.0.1-win32-x64.zip\`** — Unzip and launch \`NetX.exe\` directly without installation.
`;

async function main() {
  const token = getGithubToken();
  const owner = 'kurui-ian';
  const repo = 'NetX';
  const tag = `v${pkg.version}`;
  const releaseTitle = `Version ${pkg.version}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'NetX-Release-Publisher',
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  let release;
  // Check if release for tag already exists
  const checkRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
    { headers }
  );

  if (checkRes.ok) {
    release = await checkRes.json();
    console.log(`Found existing release ID ${release.id} for tag ${tag}, updating...`);
    const updateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          tag_name: tag,
          name: releaseTitle,
          body: RELEASE_BODY,
          draft: false,
          prerelease: false,
        }),
      }
    );
    release = await updateRes.json();
  } else {
    console.log(`Creating new GitHub Release ${releaseTitle} for tag ${tag}...`);
    const createRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tag_name: tag,
          target_commitish: 'main',
          name: releaseTitle,
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

  console.log(`Release ${releaseTitle} ready at: ${release.html_url}`);

  // Determine assets to upload
  const installerExePath = path.join(rootDir, 'release-installer', `NetX Setup ${pkg.version}.exe`);
  const assetsToUpload = [
    {
      filePath: installerExePath,
      name: `NetX-Setup-${pkg.version}.exe`,
      contentType: 'application/vnd.microsoft.portable-executable',
    },
    {
      filePath: path.join(rootDir, 'release-installer', 'latest.yml'),
      name: 'latest.yml',
      contentType: 'text/yaml',
    },
    {
      filePath: path.join(rootDir, 'release', `NetX-v${pkg.version}-win32-x64.zip`),
      name: `NetX-v${pkg.version}-win32-x64.zip`,
      contentType: 'application/zip',
    },
  ];

  const uploadBaseUrl = release.upload_url.replace(/\{\?name,label\}$/, '');

  for (const asset of assetsToUpload) {
    if (!fs.existsSync(asset.filePath)) {
      console.log(`Skipping asset ${asset.name} (file not found: ${asset.filePath})`);
      continue;
    }

    // Check existing asset
    const existing = (release.assets || []).find((a) => a.name === asset.name);
    if (existing) {
      console.log(`Deleting previous upload of ${asset.name} (asset ID: ${existing.id})...`);
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
      console.log(`Uploaded ${asset.name} successfully -> ${upJson.browser_download_url}`);
    }
  }

  console.log(`\n🎉 SUCCESS: GitHub Release published at ${release.html_url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
