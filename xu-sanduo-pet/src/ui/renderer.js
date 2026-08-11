'use strict';

(function () {
  const { PALETTE, ANIMATIONS, FRAME_SIZE } = window.SanduoSprites;
  const canvas = document.getElementById('pet');
  const ctx = canvas.getContext('2d');
  const bubble = document.getElementById('bubble');
  const badge = document.getElementById('badge');

  let scale = 4;
  let state = 'idle';
  let frameIndex = 0;
  let lastFrameAt = 0;
  let bubbleTimer = null;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function normalizeFrame(frame) {
    const w = FRAME_SIZE;
    return frame.map((line) => {
      const s = line || '';
      if (s.length === w) return s;
      if (s.length > w) return s.slice(0, w);
      return s + '.'.repeat(w - s.length);
    });
  }

  function drawFrame(frame) {
    const rows = normalizeFrame(frame);
    const h = Math.min(rows.length, FRAME_SIZE);
    const w = FRAME_SIZE;
    canvas.width = w * scale;
    canvas.height = h * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < h; y++) {
      const line = rows[y] || '';
      for (let x = 0; x < w; x++) {
        const ch = line[x] || '.';
        const color = PALETTE[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  function currentAnim() {
    return ANIMATIONS[state] || ANIMATIONS.idle;
  }

  function tick(ts) {
    const anim = currentAnim();
    const interval = 1000 / (anim.fps || 2);
    if (ts - lastFrameAt >= interval) {
      frameIndex = (frameIndex + 1) % anim.frames.length;
      lastFrameAt = ts;
      drawFrame(anim.frames[frameIndex]);
    }
    requestAnimationFrame(tick);
  }

  function showBubble(text) {
    if (!text) return;
    bubble.textContent = text;
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.add('hidden'), 3200);
  }

  function setState(next, quote, meta) {
    if (next && next !== state) {
      state = next;
      frameIndex = 0;
      lastFrameAt = 0;
      canvas.className = 'state-' + state;
      drawFrame(currentAnim().frames[0]);
    }
    if (quote) showBubble(quote);
    if (meta && meta.degraded) {
      badge.textContent = '降级监听';
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.screenX;
    lastY = e.screenY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !window.sanduo) return;
    const dx = e.screenX - lastX;
    const dy = e.screenY - lastY;
    lastX = e.screenX;
    lastY = e.screenY;
    if (dx || dy) window.sanduo.drag(dx, dy);
  });

  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });

  canvas.addEventListener('dblclick', () => {
    showBubble('不抛弃，不放弃！');
  });

  async function boot() {
    if (!window.sanduo) {
      setState('idle', '演示模式');
      requestAnimationFrame(tick);
      return;
    }
    const boot = await window.sanduo.getBootstrap();
    scale = (boot.settings && boot.settings.scale) || 4;
    window.sanduo.onState((payload) => {
      if (payload.scale) scale = payload.scale;
      setState(payload.state, payload.quote, payload);
    });
    window.sanduo.onToast((payload) => showBubble(payload.text));
    setState('idle', '三多报到！');
    requestAnimationFrame(tick);
  }

  drawFrame(ANIMATIONS.idle.frames[0]);
  boot();
})();
