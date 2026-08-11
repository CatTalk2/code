'use strict';

/**
 * 跨平台活动监听。
 * - 空闲：Electron powerMonitor
 * - 前台应用：macOS osascript / Windows PowerShell；失败则降级
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

function includesAny(haystack, needles) {
  const h = (haystack || '').toLowerCase();
  return (needles || []).some((n) => h.includes(String(n).toLowerCase()));
}

async function getFrontmostMac() {
  const script = `
    tell application "System Events"
      set frontApp to first application process whose frontmost is true
      set appName to name of frontApp
      set winTitle to ""
      try
        set winTitle to name of front window of frontApp
      end try
      return appName & "|||" & winTitle
    end tell
  `;
  const { stdout } = await execFileAsync('osascript', ['-e', script], {
    timeout: 2000,
    maxBuffer: 1024 * 64,
  });
  const [app = '', title = ''] = String(stdout).trim().split('|||');
  return { app: app.trim(), title: title.trim(), source: 'osascript' };
}

async function getFrontmostWindows() {
  const ps = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FW {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
$hwnd = [FW]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[void][FW]::GetWindowText($hwnd, $sb, $sb.Capacity)
$pid = 0
[void][FW]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
$app = if ($proc) { $proc.ProcessName } else { "" }
Write-Output ($app + "|||" + $sb.ToString())
`.trim();

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-Command', ps],
    { timeout: 3000, maxBuffer: 1024 * 64, windowsHide: true }
  );
  const [app = '', title = ''] = String(stdout).trim().split('|||');
  return { app: app.trim(), title: title.trim(), source: 'powershell' };
}

async function getFrontmostLinux() {
  try {
    const { stdout: winId } = await execFileAsync(
      'xdotool',
      ['getactivewindow'],
      { timeout: 1500 }
    );
    const id = String(winId).trim();
    const { stdout: name } = await execFileAsync(
      'xdotool',
      ['getwindowname', id],
      { timeout: 1500 }
    );
    return { app: '', title: String(name).trim(), source: 'xdotool' };
  } catch {
    return { app: '', title: '', source: 'none' };
  }
}

class ActivityMonitor {
  /**
   * @param {object} opts
   * @param {() => number} opts.getIdleSeconds - from powerMonitor
   * @param {object} opts.settings
   */
  constructor(opts) {
    this.getIdleSeconds = opts.getIdleSeconds;
    this.settings = opts.settings || {};
    this.platform = process.platform;
    this.lastAt = Date.now();
    this.degraded = false;
    this.lastFront = { app: '', title: '', source: 'none' };
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  async readFrontmost() {
    try {
      if (this.platform === 'darwin') {
        this.lastFront = await getFrontmostMac();
      } else if (this.platform === 'win32') {
        this.lastFront = await getFrontmostWindows();
      } else {
        this.lastFront = await getFrontmostLinux();
      }
      this.degraded = this.lastFront.source === 'none';
    } catch (err) {
      this.degraded = true;
      this.lastFront = {
        app: '',
        title: '',
        source: 'error',
        error: String(err && err.message ? err.message : err),
      };
    }
    return this.lastFront;
  }

  classify(front) {
    const keywords = this.settings.codingAppKeywords || [];
    const celebrateHints = this.settings.celebrateTitleHints || [];
    const debugHints = this.settings.debugTitleHints || [];
    const blob = `${front.app} ${front.title}`;
    const isCodingApp = includesAny(blob, keywords);
    let signal = null;
    if (includesAny(front.title, celebrateHints)) signal = 'celebrate';
    else if (includesAny(front.title, debugHints)) signal = 'debug';
    return { isCodingApp, signal };
  }

  async snapshot() {
    const now = Date.now();
    const deltaMs = now - this.lastAt;
    this.lastAt = now;

    const idleSec =
      typeof this.getIdleSeconds === 'function' ? this.getIdleSeconds() : 0;
    const idleMs = Math.max(0, Number(idleSec) || 0) * 1000;

    const front = await this.readFrontmost();
    const { isCodingApp, signal } = this.classify(front);

    return {
      at: now,
      deltaMs,
      idleMs,
      app: front.app,
      title: front.title,
      source: front.source,
      isCodingApp,
      signal,
      degraded: this.degraded,
      platform: this.platform,
    };
  }
}

module.exports = { ActivityMonitor, includesAny };
