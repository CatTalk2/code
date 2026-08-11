# 许三多 · 编码桌宠

像素风「许三多」桌面宠物，面向本地 coding 场景：感知你是否在 IDE 里奋斗，用睡觉、跑步、绕单杠、唱军歌等动作给你陪伴。

> 形象与台词向《士兵突击》致敬，像素精灵为原创绘制，非影视截取材。

完整需求见 [`docs/PRD.md`](./docs/PRD.md)。

## 功能（v0.1）

- 透明置顶桌面精灵，可拖拽；托盘常驻
- 自动状态：站岗写码 / 绕单杠 / 跑五公里 / 睡觉 / 唱军歌 / 敬礼 / 挠头排查
- 监听系统空闲时间 + 前台应用（macOS / Windows；失败则降级）
- 托盘菜单：显隐、置顶、点击穿透、暂停监听、手动切状态
- 同一套 Electron 工程，可打包 Mac / Windows

## 环境要求

- Node.js 18+
- macOS 12+ 或 Windows 10/11

### macOS 前台应用识别

若需识别 Cursor / VS Code 等前台窗口，请在 **系统设置 → 隐私与安全性 → 辅助功能** 中允许本应用（或终端里跑 `npm start` 时的 Electron）。未授权时自动降级为「仅空闲时间」驱动睡觉/稍息。

## 快速开始

```bash
cd xu-sanduo-pet
npm install
npm start
```

运行测试（状态机 + 精灵帧）：

```bash
npm run test:states
```

## 打包

```bash
# 当前平台
npm run dist

# 指定平台（需在对应 OS 或 CI 上）
npm run dist:mac
npm run dist:win
```

产物在 `release/`。

## 状态对照（简表）

| 状态 | 何时出现 |
|------|----------|
| 站岗写码 | 前台是 coding 工具且近期有操作 |
| 绕单杠 | 盯着 IDE 但一段时间没动（卡壳思考） |
| 跑五公里 | 连续 coding 过久，提醒活动 |
| 睡觉 | 系统空闲超过阈值（默认 5 分钟） |
| 唱军歌 | 窗口标题命中 success/passed 等弱信号，或手动触发 |
| 敬礼 | 从睡觉/离开回到 coding |
| 挠头排查 | 标题含 error/fail/debug 等 |

阈值可在用户目录下的 `settings.json` 调整（应用首次运行后由 `assets/default-settings.json` 拷贝生成）。

## 隐私

- 仅本地匹配进程名 / 窗口标题关键词
- 不上传、不记录击键内容、不截屏

## 目录

```
xu-sanduo-pet/
├── docs/PRD.md
├── electron/          # 主进程 / preload
├── src/monitor/       # 活动监听
├── src/pet/           # 状态机、精灵、台词
├── src/ui/            # 渲染层
└── assets/            # 默认配置
```

## License

MIT
