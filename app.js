(() => {
  const list = document.getElementById('stopwatchList');
  const addBtn = document.getElementById('addStopwatch');
  const doNotClickBtn = document.getElementById('doNotClick');

  // Decorative glyph layer
  const glyphLayer = document.getElementById('glyphLayer');

  // YouTube audio loop
  const YT_VIDEO_ID = 'LrndxG272HI';
  let ytPlayer = null;
  let ytReady = false;

  const confirmModal = document.getElementById('confirmModal');
  const confirmDesc = document.getElementById('confirmDesc');
  const confirmBtn = confirmModal.querySelector('[data-confirm]');
  const cancelBtn = confirmModal.querySelector('[data-cancel]');
  const modalBackdrop = confirmModal.querySelector('[data-close]');

  const stopwatches = [];
  let rafId = null;
  const STORAGE_KEY = 'multi-stopwatches-v1';

  let confirmResolver = null;
  let lastFocused = null;

  const openConfirm = ({ message, confirmLabel = 'Confirm' }) =>
    new Promise((resolve) => {
      confirmResolver = resolve;
      confirmDesc.textContent = message;
      confirmBtn.textContent = confirmLabel;
      confirmModal.classList.add('active');
      confirmModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      lastFocused = document.activeElement;
      confirmBtn.focus();
    });

  const closeConfirm = (result) => {
    confirmModal.classList.remove('active');
    confirmModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (confirmResolver) confirmResolver(result);
    confirmResolver = null;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  };

  confirmBtn.addEventListener('click', () => closeConfirm(true));
  cancelBtn.addEventListener('click', () => closeConfirm(false));
  modalBackdrop.addEventListener('click', () => closeConfirm(false));
  document.addEventListener('keydown', (event) => {
    if (!confirmModal.classList.contains('active')) return;
    if (event.key === 'Escape') closeConfirm(false);
  });

  const pad = (value, size = 2) => String(value).padStart(size, '0');

  const formatMs = (ms) => {
    const safe = Math.max(0, Math.floor(ms));
    const totalSeconds = Math.floor(safe / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const parseTimeString = (raw) => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!/^\d+(?::\d+){0,2}$/.test(trimmed)) return null;

    const timeChunks = trimmed.split(':').map(Number);
    let hours = 0, minutes = 0, seconds = 0;

    if (timeChunks.length === 1) {
      seconds = timeChunks[0];
    } else if (timeChunks.length === 2) {
      minutes = timeChunks[0];
      seconds = timeChunks[1];
    } else {
      hours = timeChunks[0];
      minutes = timeChunks[1];
      seconds = timeChunks[2];
    }

    if ([hours, minutes, seconds].some((v) => Number.isNaN(v))) return null;
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  };

  const getElapsed = (sw) => {
    if (!sw.running) return sw.timeMs;
    return sw.timeMs + (performance.now() - sw.lastStart);
  };

  const saveState = () => {
    const payload = stopwatches.map((sw) => ({
      id: sw.id,
      name: sw.name || 'Untitled',
      timeMs: Math.max(0, Math.floor(getElapsed(sw))),
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const updateRunningLoop = () => {
    const anyRunning = stopwatches.some((sw) => sw.running);
    if (anyRunning && rafId === null) rafId = requestAnimationFrame(tick);
    if (!anyRunning && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const tick = () => {
    stopwatches.forEach((sw) => updateDisplay(sw));
    if (stopwatches.some((sw) => sw.running)) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  };

  const updateDisplay = (sw) => {
    sw.timeEl.textContent = formatMs(getElapsed(sw));
    sw.statusEl.textContent = sw.running ? 'Running' : 'Paused';
    sw.statusEl.classList.toggle('running', sw.running);
    sw.toggleBtn.textContent = sw.running ? 'Pause' : 'Start';
    if (!document.activeElement || document.activeElement !== sw.timeInput) {
      sw.timeInput.placeholder = formatMs(getElapsed(sw));
    }
  };

  const applyTime = (sw) => {
    const parsed = parseTimeString(sw.timeInput.value);
    if (parsed === null) {
      sw.errorEl.textContent = 'Use formats like 90, 2:03, or 1:02:03.';
      return;
    }

    sw.timeMs = parsed;
    if (sw.running) sw.lastStart = performance.now();
    sw.errorEl.textContent = '';
    sw.timeInput.value = '';
    updateDisplay(sw);
    saveState();
  };

  const renderCard = (sw) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = sw.id;

    card.innerHTML = `
      <div class="card-top">
        <textarea class="name" rows="2" aria-label="Stopwatch name">${sw.name}</textarea>
        <span class="status">Paused</span>
      </div>
      <div class="time">00:00:00</div>
      <div class="controls">
        <button class="toggle" type="button">Start</button>
        <button class="reset" type="button">Reset</button>
        <button class="remove" type="button">Remove</button>
      </div>
      <div class="setter">
        <div class="label-row">
          <label>Set time</label>
          <button class="hint-icon" type="button" aria-label="Valid set time formats">?</button>
          <div class="tooltip" role="tooltip">Valid formats: 90 (seconds), 2:03 (mm:ss), 1:02:03 (hh:mm:ss).</div>
        </div>
        <div class="setter-row">
          <input class="time-input" type="text" placeholder="00:00:00" inputmode="numeric" />
          <button class="apply" type="button">Apply</button>
        </div>
        <p class="error"></p>
      </div>
    `;

    sw.el = card;
    sw.nameInput = card.querySelector('.name');
    sw.timeEl = card.querySelector('.time');
    sw.statusEl = card.querySelector('.status');
    sw.toggleBtn = card.querySelector('.toggle');
    sw.resetBtn = card.querySelector('.reset');
    sw.removeBtn = card.querySelector('.remove');
    sw.timeInput = card.querySelector('.time-input');
    sw.applyBtn = card.querySelector('.apply');
    sw.errorEl = card.querySelector('.error');
    sw.hintRow = card.querySelector('.label-row');
    sw.hintBtn = card.querySelector('.hint-icon');

    sw.nameInput.addEventListener('input', (event) => {
      sw.name = event.target.value.trim() || 'Untitled';
      saveState();
    });

    sw.toggleBtn.addEventListener('click', () => {
      if (sw.running) {
        sw.timeMs = getElapsed(sw);
        sw.running = false;
        sw.lastStart = 0;
      } else {
        sw.running = true;
        sw.lastStart = performance.now();
      }
      updateDisplay(sw);
      updateRunningLoop();
      saveState();
    });

    sw.resetBtn.addEventListener('click', async () => {
      const confirmed = await openConfirm({
        message: 'Reset this stopwatch to 00:00:00?',
        confirmLabel: 'Reset',
      });
      if (!confirmed) return;

      sw.timeMs = 0;
      sw.errorEl.textContent = '';
      if (sw.running) sw.lastStart = performance.now();
      updateDisplay(sw);
      saveState();
    });

    sw.removeBtn.addEventListener('click', async () => {
      const confirmed = await openConfirm({
        message: 'Remove this stopwatch? This cannot be undone.',
        confirmLabel: 'Remove',
      });
      if (!confirmed) return;

      const index = stopwatches.findIndex((item) => item.id === sw.id);
      if (index >= 0) stopwatches.splice(index, 1);
      card.remove();
      updateRunningLoop();
      saveState();
    });

    sw.applyBtn.addEventListener('click', () => applyTime(sw));
    sw.timeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyTime(sw);
      }
    });

    sw.timeInput.addEventListener('focus', () => {
      sw.timeInput.value = formatMs(getElapsed(sw));
      sw.timeInput.select();
    });

    sw.hintBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      sw.hintRow.classList.toggle('active');
    });

    updateDisplay(sw);
    return card;
  };

  const createStopwatch = (presetMs = 0, options = {}) => {
    const id = options.id ?? (globalThis.crypto?.randomUUID?.() ?? `sw-${Date.now()}-${Math.random()}`);
    const name = options.name ?? `Stopwatch ${stopwatches.length + 1}`;
    let timeMs = Number.isFinite(options.timeMs) ? options.timeMs : presetMs;
    timeMs = Math.max(0, Math.floor(timeMs));

    const sw = { id, name, timeMs, running: false, lastStart: 0 };
    stopwatches.push(sw);
    list.prepend(renderCard(sw));
    updateRunningLoop();
    if (options.persist !== false) saveState();
  };

  addBtn.addEventListener('click', () => createStopwatch());

  // DO NOT CLICK ME -> opens meme.html
  doNotClickBtn?.addEventListener('click', () => {
    window.open('https://tinyurl.com/mwazpkz2', '_blank', 'noopener,noreferrer');
  });

  const stored = loadState();
  if (stored.length) {
    stored.forEach((item) =>
      createStopwatch(0, { id: item.id, name: item.name, timeMs: item.timeMs, persist: false })
    );
    saveState();
  } else {
    createStopwatch();
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.label-row')) {
      document.querySelectorAll('.label-row.active').forEach((row) => row.classList.remove('active'));
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.label-row.active').forEach((row) => row.classList.remove('active'));
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState();
  });
  window.addEventListener('pagehide', saveState);
  window.addEventListener('beforeunload', saveState);

  /* =========================
     Homer-style glyph sprinkle
     ========================= */
  const GLYPHS = [
    '☺','☻','♥','♦','♣','♠','•','◘','○','◙','♂','♀','♪','♫','☼',
    '►','◄','↕','‼','¶','§','▬','↨','↑','↓','→','←','∟','↔','▲','▼',
    '※','∞','≈','≠','≡','∂','∑','√','∫','∆','Ω','µ','π','σ','λ','φ',
    '░','▒','▓','█','▄','▀','╬','╫','╪','╩','╦','╠','╣','║','═'
  ];

  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const buildGlyphLayer = () => {
    if (!glyphLayer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const base = Math.round((w * h) / 42000);
    const count = Math.min(110, Math.max(45, base));
    glyphLayer.innerHTML = '';

    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.className = 'glyph';

      const isSticker = Math.random() < 0.22;
      const isBig = Math.random() < 0.12;
      if (isSticker) span.classList.add('sticker');
      if (isBig) span.classList.add('big');

      const len = Math.random() < 0.35 ? Math.floor(rand(2, 7)) : 1;
      let text = '';
      for (let k = 0; k < len; k++) text += pick(GLYPHS);
      span.textContent = text;

      const size = isBig ? rand(34, 60) : rand(14, 30);
      span.style.fontSize = `${size}px`;
      span.style.left = `${rand(-0.05, 1.05) * w}px`;
      span.style.top = `${rand(-0.05, 1.05) * h}px`;
      span.style.setProperty('--rot', `${rand(-28, 28)}deg`);
      span.style.opacity = isSticker ? `${rand(0.18, 0.30)}` : `${rand(0.10, 0.20)}`;

      glyphLayer.appendChild(span);
    }
  };

  let resizeT = null;
  buildGlyphLayer();
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeT);
    resizeT = window.setTimeout(buildGlyphLayer, 140);
  });

  /* =========================
     YouTube loop attempt
     =========================
     - tries autoplay muted
     - auto-unmutes on first user interaction
  */
  const loadYouTubeApi = () => {
    if (window.YT && window.YT.Player) return Promise.resolve();
    return new Promise((resolve) => {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);

      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev();
        resolve();
      };
    });
  };

  const createYouTubePlayer = async () => {
    await loadYouTubeApi();

    ytPlayer = new window.YT.Player('ytPlayer', {
      height: '0',
      width: '0',
      videoId: YT_VIDEO_ID,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        loop: 1,
        playlist: YT_VIDEO_ID,
      },
      events: {
        onReady: () => {
          ytReady = true;
          try {
            ytPlayer.mute(); // muted autoplay is more reliable
            ytPlayer.setVolume(60);
            ytPlayer.playVideo();
          } catch {}
        },
        onStateChange: (e) => {
          try {
            if (e.data === window.YT.PlayerState.ENDED) ytPlayer.playVideo();
          } catch {}
        },
      },
    });
  };

  createYouTubePlayer().catch(() => {});

  // Auto-unmute on first interaction (no prompt)
  const tryUnmute = () => {
    if (!ytReady || !ytPlayer) return;
    try {
      ytPlayer.unMute();
      ytPlayer.setVolume(60);
      ytPlayer.playVideo();
    } catch {}
    window.removeEventListener('pointerdown', tryUnmute, { capture: true });
    window.removeEventListener('keydown', tryUnmute, { capture: true });
    window.removeEventListener('touchstart', tryUnmute, { capture: true });
  };

  window.addEventListener('pointerdown', tryUnmute, { capture: true, once: true });
  window.addEventListener('keydown', tryUnmute, { capture: true, once: true });
  window.addEventListener('touchstart', tryUnmute, { capture: true, once: true });
})();
