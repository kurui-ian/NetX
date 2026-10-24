import { createServer } from 'vite';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('========================================================');
  console.log('   NetX - Live Development Engine (Auto-Reloading & HMR)');
  console.log('========================================================\n');

  // 1. Initialize and start Vite Dev Server with HMR
  const viteServer = await createServer({
    configFile: path.join(rootDir, 'vite.config.ts'),
    root: rootDir,
    server: {
      port: 1420,
      strictPort: false,
    },
  });

  await viteServer.listen();

  const address = viteServer.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 1420;
  const devUrl = `http://localhost:${port}`;

  console.log(`⚡ [NetX] Vite HMR Server active at: ${devUrl}`);
  console.log(`📡 [NetX] Hot Module Replacement (HMR) active — edits in src/ reflect instantly.`);
  console.log(`🔄 [NetX] Edits in electron/ will automatically restart the app window.`);
  console.log(`🛠️ [NetX] Dev keyboard shortcuts:`);
  console.log(`   - F12: Toggle Chrome Developer Tools`);
  console.log(`   - F5 or Ctrl+R: Hard reload view\n`);

  // 2. Manage Electron Process Lifecycle
  let electronProcess = null;
  let isRestarting = false;
  const electronCli = path.join(rootDir, 'node_modules', 'electron', 'cli.js');

  function launchElectron() {
    if (electronProcess) {
      isRestarting = true;
      try {
        electronProcess.kill();
      } catch {}
      electronProcess = null;
    }

    const env = {
      ...process.env,
      VITE_DEV_SERVER_URL: devUrl,
    };

    electronProcess = spawn(process.execPath, [electronCli, '.'], {
      cwd: rootDir,
      env,
      stdio: 'inherit',
    });

    electronProcess.on('close', (code) => {
      if (!isRestarting) {
        console.log('\n👋 [NetX] Window closed by user. Shutting down development server...');
        viteServer.close().then(() => {
          process.exit(code || 0);
        });
      }
      isRestarting = false;
    });

    electronProcess.on('error', (err) => {
      console.error('\n❌ Failed to start Electron:', err.message);
    });
  }

  // 3. Auto-restart Electron when main process files change
  const electronDir = path.join(rootDir, 'electron');
  let restartDebounce = null;

  if (fs.existsSync(electronDir)) {
    fs.watch(electronDir, { recursive: true }, (_event, filename) => {
      if (filename && (filename.endsWith('.cjs') || filename.endsWith('.js'))) {
        clearTimeout(restartDebounce);
        restartDebounce = setTimeout(() => {
          console.log(`\n🔄 [NetX] Change detected in electron/${filename}. Restarting NetX application window...`);
          launchElectron();
        }, 350);
      }
    });
  }

  // Initial launch
  launchElectron();

  // Handle Ctrl+C termination cleanly
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping dev server...');
    if (electronProcess) {
      try {
        electronProcess.kill();
      } catch {}
    }
    viteServer.close().then(() => {
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error('Fatal error starting NetX dev server:', err);
  process.exit(1);
});
