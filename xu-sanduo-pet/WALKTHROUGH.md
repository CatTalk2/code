# Walkthrough：许三多编码桌宠

## 交付物

- 完整 PRD：`xu-sanduo-pet/docs/PRD.md`
- 可运行 Electron 应用：`xu-sanduo-pet/`（Mac / Windows 同一套代码）
- PR：https://github.com/CatTalk2/code/pull/2

## 状态精灵预览

| 稍息 | 站岗写码 | 绕单杠 | 唱军歌 |
|------|----------|--------|--------|
| <img src="/opt/cursor/artifacts/xu-sanduo-previews/idle.png" alt="idle" width="96" /> | <img src="/opt/cursor/artifacts/xu-sanduo-previews/coding.png" alt="coding" width="96" /> | <img src="/opt/cursor/artifacts/xu-sanduo-previews/monkey_bar.png" alt="bar" width="96" /> | <img src="/opt/cursor/artifacts/xu-sanduo-previews/celebrate.png" alt="song" width="96" /> |

另有：跑步、睡觉、敬礼、挠头排查（见 `assets/previews/`）。

## 怎么跑

```bash
cd xu-sanduo-pet && npm install && npm start
```

托盘右键可手动切全部标志性动作；打包用 `npm run dist:mac` / `npm run dist:win`。

## 验证

- `npm run test:states` 通过
- 无头环境 `xvfb-run npm start` 打出 `[xu-sanduo] ready on linux`
