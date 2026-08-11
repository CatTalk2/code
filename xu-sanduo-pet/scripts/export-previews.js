'use strict';

/**
 * 无 Electron 依赖：把各状态首帧导出为 PPM，便于快速目视检查。
 */
const fs = require('fs');
const path = require('path');
const { ANIMATIONS, PALETTE, FRAME_SIZE } = require('../src/pet/sprites');

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return [0, 0, 0];
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function writePpm(file, frame, scale) {
  const w = FRAME_SIZE * scale;
  const h = FRAME_SIZE * scale;
  const lines = [`P3`, `${w} ${h}`, `255`];
  for (let y = 0; y < FRAME_SIZE; y++) {
    const row = frame[y] || '';
    for (let sy = 0; sy < scale; sy++) {
      const cols = [];
      for (let x = 0; x < FRAME_SIZE; x++) {
        const ch = row[x] || '.';
        const color = PALETTE[ch];
        const rgb = color ? hexToRgb(color) : [240, 248, 236];
        for (let sx = 0; sx < scale; sx++) {
          cols.push(rgb.join(' '));
        }
      }
      lines.push(cols.join(' '));
    }
  }
  fs.writeFileSync(file, lines.join('\n'));
}

const outDir = path.join(__dirname, '..', 'assets', 'previews');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, anim] of Object.entries(ANIMATIONS)) {
  writePpm(path.join(outDir, `${name}.ppm`), anim.frames[0], 4);
}
console.log('Wrote previews to', outDir);
