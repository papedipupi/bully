<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Malicious Website Demo (Safe)</title>
    <style>
      :root { --ink:#111; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        overflow: hidden;
        display: grid;
        place-items: center;
        background: repeating-linear-gradient(45deg, #ff0, #ff0 18px, #000 18px, #000 36px);
        font-family: Impact, system-ui, sans-serif;
        color: #fff;
      }
      .panel {
        width: min(720px, 92vw);
        background: rgba(0,0,0,0.75);
        border: 6px solid rgba(255,255,255,0.25);
        border-radius: 18px;
        padding: 18px 18px 14px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.35);
        text-align: center;
      }
      h1 {
        margin: 0 0 10px;
        font-size: clamp(1.6rem, 4vw, 2.6rem);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      p {
        margin: 0 0 10px;
        font-family: system-ui, sans-serif;
        font-weight: 600;
        opacity: 0.95;
      }
      .row {
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 10px;
      }
      button {
        border: none;
        border-radius: 999px;
        padding: 12px 14px;
        font-weight: 900;
        cursor: pointer;
      }
      .danger { background: #ff3b3b; color: #1a1a1a; }
      .ok { background: #4dff88; color: #1a1a1a; }
      .note {
        margin-top: 12px;
        font-size: 0.92rem;
        font-family: system-ui, sans-serif;
        opacity: 0.9;
      }
      .badge {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.18);
        border: 1px solid rgba(255,255,255,0.22);
        font-family: system-ui, sans-serif;
        font-weight: 700;
      }

      /* floating nonsense */
      .float {
        position: fixed;
        left: 0; top: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .bouncer {
        position: absolute;
        font-size: clamp(2.4rem, 8vw, 6rem);
        text-shadow: 0 12px 30px rgba(0,0,0,0.45);
        opacity: 0.35;
        animation: bounce 2.2s linear infinite;
      }
      @keyframes bounce {
        0% { transform: translate(0,0) rotate(-3deg); }
        25% { transform: translate(40vw,-10vh) rotate(3deg); }
        50% { transform: translate(-35vw,18vh) rotate(-3deg); }
        75% { transform: translate(-15vw,-20vh) rotate(3deg); }
        100% { transform: translate(0,0) rotate(-3deg); }
      }
    </style>
  </head>
  <body>
    <div class="float" aria-hidden="true">
      <div class="bouncer">⚠️💥⚠️💥</div>
    </div>

    <div class="panel">
      <h1>Safe “Malicious Site” Demo</h1>
      <p>
        This page simulates techniques used by malicious prank sites
        <span class="badge">(self-contained, no external harm)</span>.
      </p>
      <p class="note">
        Tip for your presentation: explain how browsers limit popups and autoplay now.
      </p>

      <div class="row">
        <button class="danger" id="spam">Simulate popup spam</button>
        <button class="ok" id="stop">STOP DEMO (ESC)</button>
      </div>

      <p class="note">
        If popups are blocked, that’s the point — modern browsers defend against this.
      </p>
    </div>

    <script>
      let running = false;
      let timer = null;
      const opened = new Set();

      const openPopup = () => {
        // Many browsers will block these after a few. That's expected.
        const w = 360 + Math.floor(Math.random() * 240);
        const h = 260 + Math.floor(Math.random() * 240);
        const x = Math.floor(Math.random() * (screen.width - w));
        const y = Math.floor(Math.random() * (screen.height - h));
        const win = window.open(
          location.href,
          '_blank',
          `width=${w},height=${h},left=${x},top=${y},noopener`
        );
        if (win) opened.add(win);
      };

      const start = () => {
        if (running) return;
        running = true;

        const loop = () => {
          if (!running) return;
          openPopup();
          timer = setTimeout(loop, 450);
        };
        loop();
      };

      const stop = () => {
        running = false;
        clearTimeout(timer);
        timer = null;

        // attempt to close any that were opened (some may not close due to browser policies)
        for (const w of opened) {
          try { w.close(); } catch {}
        }
        opened.clear();
      };

      document.getElementById('spam').addEventListener('click', start);
      document.getElementById('stop').addEventListener('click', stop);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') stop();
      });

      window.addEventListener('beforeunload', stop);
      window.addEventListener('pagehide', stop);
    </script>
  </body>
</html>
