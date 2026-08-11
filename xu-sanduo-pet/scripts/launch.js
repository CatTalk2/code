'use strict';

/**
 * 跨平台启动入口（Windows 不必依赖 bash）。
 * Mac/Windows → 原生 Electron；Linux → soft-gpu (+ dbus-run-session 若可用)
 */
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const extra = process.argv.slice(2);
const isLinux = process.platform === 'linux';
const electronBin = require('electron');

const args = isLinux ? ['--soft-gpu', ...extra] : [...extra];
const env = { ...process.env };

if (isLinux && !env.DBUS_SESSION_BUS_ADDRESS) {
  delete env.DBUS_SESSION_BUS_ADDRESS;
}

function run(cmd, cmdArgs, opts = {}) {
  const child = spawn(cmd, cmdArgs, {
    cwd: root,
    env: opts.env || env,
    stdio: 'inherit',
    shell: opts.shell || false,
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code == null ? 1 : code);
  });
}

if (isLinux && !process.env.DBUS_SESSION_BUS_ADDRESS) {
  // 尝试 dbus-run-session
  const which = spawn('bash', ['-lc', 'command -v dbus-run-session'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  let out = '';
  which.stdout.on('data', (d) => {
    out += d;
  });
  which.on('close', (code) => {
    if (code === 0 && out.trim()) {
      run('dbus-run-session', ['--', electronBin, '.', ...args]);
    } else {
      run(electronBin, ['.', ...args]);
    }
  });
} else {
  run(electronBin, ['.', ...args]);
}
