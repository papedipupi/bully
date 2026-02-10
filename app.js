(() => {
  const list = document.getElementById('stopwatchList');
  const addBtn = document.getElementById('addStopwatch');

  // Decorative glyph layer
  const glyphLayer = document.getElementById('glyphLayer');

  // Sound toggle
  const soundToggle = document.getElementById('soundToggle');

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

    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
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
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (timeChunks.length === 1) {
      seconds = timeChunks[0];
    } else if (timeChunks.length === 2) {
      minutes = timeChunks[0];
      seconds = timeChunks[1];
    } else if (timeChunks.length === 3) {
      hours = timeChunks[0];
      minutes = timeChunks[1];
      seconds = timeChunks[2];
    }

    if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) return null;

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds * 1000;
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
    } catch (error) {
      // Ignore storage errors (quota/private mode).
    }
  };

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (error) {
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

    const base = Math.round((w * h) / 45000);
    const count = Math.min(90, Math.max(35, base));

    glyphLayer.innerHTML = '';

    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.className = 'glyph';

      const isSticker = Math.random() < 0.18;
      const isBig = Math.random() < 0.12;

      if (isSticker) span.classList.add('sticker');
      if (isBig) span.classList.add('big');

      const len = Math.random() < 0.28 ? Math.floor(rand(2, 6)) : 1;
      let text = '';
      for (let k = 0; k < len; k++) text += pick(GLYPHS);
      span.textContent = text;

      const size = isBig ? rand(34, 56) : rand(14, 28);
      span.style.fontSize = `${size}px`;

      span.style.left = `${rand(-0.05, 1.05) * w}px`;
      span.style.top = `${rand(-0.05, 1.05) * h}px`;
      span.style.setProperty('--rot', `${rand(-22, 22)}deg`);
      span.style.opacity = isSticker ? `${rand(0.16, 0.26)}` : `${rand(0.08, 0.18)}`;

      glyphLayer.appendChild(span);
    }
  };

  let resizeT = null;
  buildGlyphLayer();
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeT);
    resizeT = window.setTimeout(buildGlyphLayer, 120);
  });

  /* =========================
     Random “Homer-web” sounds
     (synthesized, no files)
     ========================= */
  const SOUND_KEY = 'multi-stopwatches-sound-v1';
  let audioCtx = null;
  let soundEnabled = false;
  let soundTimer = null;

  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  const setSoundUi = (on) => {
    if (!soundToggle) return;
    soundToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundToggle.textContent = on ? 'Sound: On' : 'Sound: Off';
  };

  const loadSoundPref = () => {
    try {
      return localStorage.getItem(SOUND_KEY) === 'on';
    } catch {
      return false;
    }
  };

  const saveSoundPref = (on) => {
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      // ignore
    }
  };

  const ensureAudio = async () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state !== 'running') {
      // Must be called in a user-gesture handler
      await audioCtx.resume();
    }
  };

  const now = () => (audioCtx ? audioCtx.currentTime : 0);

  // Soft limiter-ish output
  const makeMaster = () => {
    const master = audioCtx.createGain();
    master.gain.value = 0.45;

    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;

    master.connect(comp);
    comp.connect(audioCtx.destination);

    return master;
  };

  let masterOut = null;

  const ensureMaster = () => {
    if (!masterOut) masterOut = makeMaster();
    return masterOut;
  };

  // Bark-ish: noise burst + pitchy “woof” formant
  const playBark = () => {
    const t0 = now();
    const out = ensureMaster();

    // Noise buffer
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.12);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // slightly colored noise
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(900, t0);
    noiseFilter.Q.setValueAtTime(1.2, t0);

    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0, t0);
    ng.gain.linearRampToValueAtTime(0.9, t0 + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(ng);
    ng.connect(out);

    noise.start(t0);
    noise.stop(t0 + 0.13);

    // “Woof” tone
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220 + rand(-30, 30), t0);
    osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.10);

    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(900, t0);
    filt.frequency.exponentialRampToValueAtTime(380, t0 + 0.12);

    const og = audioCtx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.45, t0 + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);

    osc.connect(filt);
    filt.connect(og);
    og.connect(out);

    osc.start(t0);
    osc.stop(t0 + 0.15);
  };

  // Jingle-bell-ish: short metallic “ding” clusters
  const playJingle = () => {
    const t0 = now();
    const out = ensureMaster();

    const bell = (t, freq, dur, amp) => {
      const o1 = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      o1.type = 'sine';
      o2.type = 'sine';

      // Inharmonic partial
      o1.frequency.setValueAtTime(freq, t);
      o2.frequency.setValueAtTime(freq * 2.7, t);

      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const hp = audioCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(350, t);

      o1.connect(hp);
      o2.connect(hp);
      hp.connect(g);
      g.connect(out);

      o1.start(t);
      o2.start(t);
      o1.stop(t + dur + 0.02);
      o2.stop(t + dur + 0.02);
    };

    // Little pattern — randomize a bit
    const baseFreqs = [784, 659, 880, 988, 740];
    const hits = Math.floor(rand(3, 6));
    for (let i = 0; i < hits; i++) {
      const dt = i * rand(0.07, 0.12);
      const f = pick(baseFreqs) * (Math.random() < 0.25 ? 2 : 1);
      bell(t0 + dt, f, rand(0.25, 0.45), rand(0.08, 0.15));
    }
  };

  const playRandomSound = () => {
    if (!soundEnabled) return;
    if (!audioCtx || audioCtx.state !== 'running') return;

    // Don’t play while confirmation modal is open
    if (confirmModal?.classList?.contains('active')) return;

    // Pick one
    const pickOne = Math.random();
    if (pickOne < 0.55) {
      // sometimes a mini bark burst
      const bursts = Math.random() < 0.35 ? 2 : 1;
      playBark();
      if (bursts === 2) setTimeout(() => playBark(), Math.floor(rand(120, 220)));
    } else {
      playJingle();
    }
  };

  const scheduleNextSound = () => {
    if (!soundEnabled) return;

    // Wider spacing if user prefers reduced motion (less “busy” overall)
    const minMs = prefersReduced ? 45000 : 25000;
    const maxMs = prefersReduced ? 90000 : 70000;
    const delay = Math.floor(rand(minMs, maxMs));

    window.clearTimeout(soundTimer);
    soundTimer = window.setTimeout(() => {
      playRandomSound();
      scheduleNextSound();
    }, delay);
  };

  const startSounds = () => {
    if (soundEnabled) return;
    soundEnabled = true;
    setSoundUi(true);
    saveSoundPref(true);
    scheduleNextSound();
  };

  const stopSounds = () => {
    soundEnabled = false;
    setSoundUi(false);
    saveSoundPref(false);
    window.clearTimeout(soundTimer);
    soundTimer = null;
  };

  // Init UI from preference, but DO NOT start audio until user gesture
  const prefOn = loadSoundPref();
  setSoundUi(false);

  soundToggle?.addEventListener('click', async () => {
    if (!soundEnabled) {
      try {
        await ensureAudio(); // user gesture = allowed
        ensureMaster();
        startSounds();
        // Play a tiny "enable" ping so user knows it's on
        playJingle();
      } catch {
        // If audio is blocked for any reason, stay off.
        stopSounds();
      }
    } else {
      stopSounds();
    }
  });

  // If they had pref ON previously, we can prime UI with a hint:
  if (prefOn) {
    // show as Off but suggest it was previously enabled by flipping text subtly
    // (still requires click to actually run audio)
    if (soundToggle) soundToggle.textContent = 'Sound: Off (tap to enable)';
  }
})();
