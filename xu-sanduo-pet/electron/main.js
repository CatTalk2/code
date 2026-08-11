'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Linux / CI / 无头环境常见噪音：
 * - 空的 DBUS_SESSION_BUS_ADDRESS 会触发 Chromium bus.cc 报错
 * - 无硬件 GPU 时 viz GPU process 反复退出
 * 在 app ready 前处理；Mac / Windows 桌面正常路径不受影响。
 */
(function hardenRuntimeEnv() {
  if (process.env.DBUS_SESSION_BUS_ADDRESS === '') {
    delete process.env.DBUS_SESSION_BUS_ADDRESS;
  }
})();

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, powerMonitor, screen } = require('electron');
const { ActivityMonitor } = require('../src/monitor/activity');
const { StateMachine, STATES } = require('../src/pet/state-machine');
const { pickQuote } = require('../src/pet/quotes');

const isDev = process.argv.includes('--enable-logging') || !app.isPackaged;
const softGpu =
  process.env.SANDUO_SOFT_GPU === '1' ||
  process.argv.includes('--soft-gpu') ||
  process.env.ELECTRON_DISABLE_GPU === '1' ||
  Boolean(process.env.CI) ||
  Boolean(process.env.CURSOR_AGENT);

// Chromium 开关必须在 ready 前。默认 npm start 带 --soft-gpu，真机可 npm run start:native
if (softGpu) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('use-gl', 'swiftshader');
}

let petWindow = null;
let tray = null;
let monitor = null;
let machine = null;
let pollTimer = null;
let settings = null;
let lastState = null;

function userDataSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  const defaultsPath = path.join(__dirname, '..', 'assets', 'default-settings.json');
  const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
  try {
    const raw = fs.readFileSync(userDataSettingsPath(), 'utf8');
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(userDataSettingsPath()), { recursive: true });
    fs.writeFileSync(userDataSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('save settings failed', err);
  }
}

function createTrayIcon() {
  // 16x16 简易像素绿帽图标
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const inHead = x >= 5 && x <= 10 && y >= 2 && y <= 6;
      const inBody = x >= 4 && x <= 11 && y >= 7 && y <= 12;
      const inBoot = (x >= 4 && x <= 6 && y >= 13 && y <= 14) || (x >= 9 && x <= 11 && y >= 13 && y <= 14);
      if (inHead) {
        r = 42;
        g = 33;
        b = 24;
        a = 255;
      } else if (inBody) {
        r = 79;
        g = 122;
        b = 69;
        a = 255;
      } else if (inBoot) {
        r = 30;
        g = 30;
        b = 30;
        a = 255;
      }
      canvas[i] = r;
      canvas[i + 1] = g;
      canvas[i + 2] = b;
      canvas[i + 3] = a;
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function createPetWindow() {
  const display = screen.getPrimaryDisplay();
  const work = display.workArea;
  const scale = Number(settings.scale) || 10;
  const winW = Number(settings.windowWidth) || Math.max(360, 28 * scale + 140);
  const winH = Number(settings.windowHeight) || Math.max(340, 28 * scale + 160);
  const anchor = settings.anchor || 'top-center';

  let x;
  let y;
  if (anchor === 'top-center') {
    x = Math.round(work.x + (work.width - winW) / 2);
    y = Math.round(work.y + 16);
  } else if (anchor === 'bottom-right') {
    x = Math.round(work.x + work.width - winW - 24);
    y = Math.round(work.y + work.height - winH - 24);
  } else {
    x = Math.round(work.x + (work.width - winW) / 2);
    y = Math.round(work.y + 16);
  }

  petWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    alwaysOnTop: settings.alwaysOnTop !== false,
    skipTaskbar: false,
    fullscreenable: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.setAlwaysOnTop(settings.alwaysOnTop !== false, 'screen-saver');

  petWindow.loadFile(path.join(__dirname, '..', 'src', 'ui', 'index.html'));

  petWindow.once('ready-to-show', () => {
    petWindow.show();
    petWindow.focus();
    petWindow.moveTop();
    applyClickThrough();
    // 首次亮相：敬礼 3 秒，方便一眼认出，然后交给状态机
    const snap = machine.force(STATES.GREET, 3000);
    sendState(snap, true);
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

function applyClickThrough() {
  if (!petWindow) return;
  const on = Boolean(settings.clickThrough);
  petWindow.setIgnoreMouseEvents(on, { forward: true });
}

function sendState(snap, forceQuote = false) {
  if (!petWindow || petWindow.isDestroyed()) return;
  const changed = forceQuote || snap.state !== lastState;
  lastState = snap.state;
  petWindow.webContents.send('pet:state', {
    ...snap,
    quote: changed ? pickQuote(snap.state) : null,
    scale: settings.scale || 4,
    degraded: monitor ? monitor.degraded : false,
  });
}

function buildTrayMenu() {
  const stateItems = Object.entries({
    [STATES.IDLE]: '稍息',
    [STATES.CODING]: '站岗写码',
    [STATES.MONKEY_BAR]: '绕单杠',
    [STATES.RUNNING]: '跑五公里',
    [STATES.SLEEPING]: '睡觉',
    [STATES.CELEBRATE]: '唱军歌',
    [STATES.GREET]: '敬礼',
    [STATES.DEBUG]: '挠头排查',
  }).map(([id, label]) => ({
    label,
    click: () => {
      const snap = machine.force(id, id === STATES.RUNNING ? 12000 : 10000);
      sendState(snap, true);
    },
  }));

  return Menu.buildFromTemplate([
    {
      label: '显示 / 隐藏',
      click: () => {
        if (!petWindow) return;
        if (petWindow.isVisible()) petWindow.hide();
        else petWindow.showInactive();
      },
    },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: settings.alwaysOnTop !== false,
      click: (item) => {
        settings.alwaysOnTop = item.checked;
        if (petWindow) petWindow.setAlwaysOnTop(item.checked, 'screen-saver');
        saveSettings();
      },
    },
    {
      label: '点击穿透',
      type: 'checkbox',
      checked: Boolean(settings.clickThrough),
      click: (item) => {
        settings.clickThrough = item.checked;
        applyClickThrough();
        saveSettings();
      },
    },
    {
      label: '暂停自动监听',
      type: 'checkbox',
      checked: Boolean(settings.paused),
      click: (item) => {
        settings.paused = item.checked;
        machine.updateSettings(settings);
        saveSettings();
      },
    },
    { type: 'separator' },
    { label: '手动状态', submenu: stateItems },
    {
      label: '清除状态锁定',
      click: () => {
        settings.lockedState = null;
        machine.updateSettings(settings);
        machine.clearForce();
        saveSettings();
      },
    },
    { type: 'separator' },
    {
      label: '关于许三多桌宠',
      click: () => {
        if (!petWindow) return;
        petWindow.webContents.send('pet:toast', {
          text: '不抛弃，不放弃 · v' + app.getVersion(),
        });
      },
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('许三多 · 编码桌宠');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    if (!petWindow) return;
    if (petWindow.isVisible()) petWindow.hide();
    else petWindow.showInactive();
  });
}

async function tick() {
  if (!monitor || !machine) return;
  try {
    const snap = await monitor.snapshot();
    const stateSnap = machine.evaluate(snap);
    sendState(stateSnap, false);
    if (tray) {
      const tag = stateSnap.state;
      const deg = snap.degraded ? ' · 降级' : '';
      tray.setToolTip(`许三多 · ${tag}${deg}`);
    }
  } catch (err) {
    console.error('tick failed', err);
  }
}

function startLoop() {
  const ms = settings.pollIntervalMs || 1000;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(tick, ms);
  tick();
}

ipcMain.handle('pet:get-bootstrap', () => ({
  settings: {
    scale: settings.scale,
    clickThrough: settings.clickThrough,
    alwaysOnTop: settings.alwaysOnTop,
  },
  states: STATES,
  version: app.getVersion(),
}));

ipcMain.on('pet:drag', (_e, { dx, dy }) => {
  if (!petWindow) return;
  const [x, y] = petWindow.getPosition();
  petWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
});

ipcMain.on('pet:set-click-through', (_e, value) => {
  settings.clickThrough = Boolean(value);
  applyClickThrough();
  saveSettings();
  if (tray) tray.setContextMenu(buildTrayMenu());
});

app.whenReady().then(() => {
  settings = loadSettings();
  machine = new StateMachine({ settings });
  monitor = new ActivityMonitor({
    settings,
    getIdleSeconds: () => {
      try {
        return powerMonitor.getSystemIdleTime();
      } catch {
        return 0;
      }
    },
  });

  createPetWindow();
  createTray();
  startLoop();

  if (isDev) {
    console.log('[xu-sanduo] ready on', process.platform);
  }
});

app.on('window-all-closed', () => {
  // 托盘常驻：关闭宠物窗不退出应用
  if (process.platform !== 'darwin') {
    // Windows/Linux 仍保持托盘；仅当用户点退出才 quit
  }
});

app.on('before-quit', () => {
  if (pollTimer) clearInterval(pollTimer);
  saveSettings();
});

app.on('activate', () => {
  if (petWindow) petWindow.showInactive();
  else createPetWindow();
});
