import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const releaseAppDir = path.join(rootDir, 'release', 'NetX-win32-x64', 'resources', 'app');

// Ensure release/NetX-win32-x64/resources/app exists and is clean
fs.rmSync(releaseAppDir, { recursive: true, force: true });
fs.mkdirSync(releaseAppDir, { recursive: true });

// Copy dist/ and electron/
fs.cpSync(path.join(rootDir, 'dist'), path.join(releaseAppDir, 'dist'), { recursive: true });
fs.cpSync(path.join(rootDir, 'electron'), path.join(releaseAppDir, 'electron'), {
  recursive: true,
});

// Write clean production package.json for NetX.exe
const pkg = {
  name: 'netx',
  productName: 'NetX',
  version: '1.0.0',
  description: 'NetX — Native Windows Network Utility & Telemetry Suite',
  main: 'electron/main.cjs',
};

fs.writeFileSync(
  path.join(releaseAppDir, 'package.json'),
  JSON.stringify(pkg, null, 2),
  'utf8'
);

console.log('Successfully synced NetX application bundle into release/NetX-win32-x64/resources/app');
