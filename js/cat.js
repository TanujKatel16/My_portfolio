/* cat.js — Pixel Cat Interactive Animation
   A canvas-drawn pixel cat that walks, runs toward cursor,
   idles, sits, and meows. No external assets needed.
*/

(function () {
  const canvas = document.getElementById('cat-canvas');
  const ctx = canvas.getContext('2d');
  const bubble = document.getElementById('meow-bubble');

  // ── Pixel scale & canvas setup ──────────────────────────
  const SCALE = 4;   // each pixel = 4×4 real pixels
  const W = Math.floor(canvas.offsetWidth / SCALE);
  const H = Math.floor(canvas.offsetHeight / SCALE);
  canvas.width  = W * SCALE;
  canvas.height = H * SCALE;
  ctx.imageSmoothingEnabled = false;

  // ── Colors ───────────────────────────────────────────────
  const COLORS = {
    body:  '#d4a96a',
    dark:  '#8b5e3c',
    light: '#f5d9a8',
    nose:  '#e07070',
    eye:   '#222222',
    shine: '#ffffff',
    tail:  '#c4904a',
    out:   '#4a2e1a',   // outline
    bg:    'transparent',
  };

  // ── Cat pixel templates (16×12 grid, 0=transparent) ──────
  // Each frame is a 2D array [row][col], values map to COLORS keys
  // b=body, d=dark, l=light, n=nose, e=eye, s=shine, t=tail, o=out

  function pixelMap(str) {
    return str.trim().split('\n').map(row =>
      row.split('').map(c => c === '.' ? null : c)
    );
  }

  // ── Frame definitions (14 wide × 10 tall) ────────────────
  // States: idle(2 frames), walk(4 frames), run(4 frames), sit(1), sleep(1)

  const FRAMES = {
    idle0: pixelMap([
      '.....ooo......',
      '....obobo.....',
      '...obbbbboo...',
      '..obbbbbbbo...',
      '..oblbebbbo...',
      '..obbbbbbboo..',
      '...obbbbbbb...',
      '....obbbbo....',
      '..oobbbbooott.',
      '.otttttttttt..',
    ].join('\n')),

    idle1: pixelMap([
      '.....ooo......',
      '....obobo.....',
      '...obbbbboo...',
      '..obbbbbbbo...',
      '..oblbebbbo...',
      '..obbbbbbboo..',
      '...obbbbbbb...',
      '....obbbbo....',
      '..oobbbbooott.',
      '.otttttttttt..',
    ].join('\n').replace('lbe', 'lbE')), // eye blink variant handled in draw

    walk0: pixelMap([
      '....ooo.......',
      '...obobo......',
      '..obbbbboo....',
      '.obbbbbbbo....',
      '.oblbebbbo....',
      '.obbbbbbboo...',
      '..obbbbbbb....',
      '..obbbboo.....',
      'obbbbbooo.tt..',
      '.o.....otttt..',
    ].join('\n')),

    walk1: pixelMap([
      '....ooo.......',
      '...obobo......',
      '..obbbbboo....',
      '.obbbbbbbo....',
      '.oblbebbbo....',
      '.obbbbbbboo...',
      '..obbbbbbb....',
      '...obbboo.....',
      '.obbbbooott...',
      '.o......tttt..',
    ].join('\n')),

    walk2: pixelMap([
      '....ooo.......',
      '...obobo......',
      '..obbbbboo....',
      '.obbbbbbbo....',
      '.oblbebbbo....',
      '.obbbbbbboo...',
      '..obbbbbbb....',
      '..obbbboo.....',
      '.obbbbbooo.tt.',
      '..o.....otttt.',
    ].join('\n')),

    walk3: pixelMap([
      '....ooo.......',
      '...obobo......',
      '..obbbbboo....',
      '.obbbbbbbo....',
      '.oblbebbbo....',
      '.obbbbbbboo...',
      '..obbbbbbb....',
      '...obbbboo....',
      '.obbbboooott..',
      '......o.tttt..',
    ].join('\n')),

    sit: pixelMap([
      '.....ooo......',
      '....obobo.....',
      '...obbbbboo...',
      '..obbbbbbbo...',
      '..oblbebbbo...',
      '..obbbbbbboo..',
      '..obbbbbbbbo..',
      '..obbbbbbbbo..',
      '..obbbbbbbboo.',
      '..ottttttttto.',
    ].join('\n')),

    sleep: pixelMap([
      '..............',
      '.....ooooo....',
      '....obbbbboo..',
      '...obbbbbbboo.',
      '...obbxxxbbbo.',
      '...obbbbbbbbo.',
      '..obbbbbbbbbo.',
      '..obbbbbbbbbo.',
      '..obbbbbbbboo.',
      '..ottttttttto.',
    ].join('\n')),
  };

  const colorKey = {
    b: 'body', d: 'dark', l: 'light', n: 'nose',
    e: 'eye', E: 'eye', s: 'shine', t: 'tail',
    o: 'out', x: 'shine', // x used for sleep eyes (closed line)
  };

  // ── Draw a single pixel frame ─────────────────────────────
  function drawFrame(frame, cx, cy, flip) {
    const rows = frame.length;
    const cols = frame[0].length;
    const ox = cx - Math.floor(cols / 2);
    const oy = cy - Math.floor(rows / 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = frame[r][flip ? (cols - 1 - c) : c];
        if (!cell) continue;
        const key = colorKey[cell];
        if (!key) continue;
        ctx.fillStyle = COLORS[key];
        ctx.fillRect((ox + c) * SCALE, (oy + r) * SCALE, SCALE, SCALE);
      }
    }
  }

  // ── Cat state machine ─────────────────────────────────────
  const cat = {
    x: W * 0.3,      // position in pixel units
    y: H - 14,
    vx: 0,
    state: 'idle',   // idle | walk | run | sit | sleep
    frame: 0,
    frameTick: 0,
    frameSpeed: 8,   // ticks per frame
    dir: 1,          // 1=right, -1=left
    blinkTimer: 0,
    blinking: false,
    idleTimer: 0,
    meowTimer: 0,
    targetX: null,
    sleeping: false,
    sleepTimer: 0,
  };

  const WALK_FRAMES = ['walk0','walk1','walk2','walk3'];
  const IDLE_FRAMES = ['idle0','idle1'];
  const MEOW_TEXTS  = ['meow!','mrrrow~','prrr...','nyaa!','*stares*','feed me'];

  let mouseX = null;   // in pixel units
  let mouseY = null;

  // ── Mouse tracking ────────────────────────────────────────
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / SCALE;
    mouseY = (e.clientY - rect.top)  / SCALE;
  });
  canvas.addEventListener('mouseleave', () => {
    mouseX = null;
    mouseY = null;
  });
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / SCALE;
    // If clicking near cat, meow!
    if (Math.abs(cx - cat.x) < 20) triggerMeow();
  });

  function triggerMeow() {
    const text = MEOW_TEXTS[Math.floor(Math.random() * MEOW_TEXTS.length)];
    bubble.textContent = text;
    bubble.classList.add('visible');
    // Position bubble above cat
    const rect = canvas.getBoundingClientRect();
    const catScreenX = rect.left + cat.x * SCALE;
    const catScreenY = rect.top  + (cat.y - 12) * SCALE;
    bubble.style.left = (catScreenX - 40) + 'px';
    bubble.style.top  = (catScreenY - 40) + 'px';
    cat.meowTimer = 120;
  }

  // ── Zzzz particles for sleep ──────────────────────────────
  const zParticles = [];
  function spawnZ() {
    zParticles.push({
      x: cat.x + 6, y: cat.y - 8,
      life: 80, maxLife: 80, size: 1 + Math.random(),
    });
  }

  function updateZ() {
    for (let i = zParticles.length - 1; i >= 0; i--) {
      const p = zParticles[i];
      p.y -= 0.3;
      p.x += 0.2;
      p.life--;
      if (p.life <= 0) zParticles.splice(i, 1);
    }
  }

  function drawZ() {
    ctx.font = `bold ${8 + Math.floor(Math.random() * 2)}px monospace`;
    ctx.fillStyle = COLORS.light;
    for (const p of zParticles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillText('z', p.x * SCALE, p.y * SCALE);
    }
    ctx.globalAlpha = 1;
  }

  // ── Main update ───────────────────────────────────────────
  let tick = 0;

  function update() {
    tick++;
    cat.frameTick++;

    // Blink logic
    cat.blinkTimer--;
    if (cat.blinkTimer <= 0) {
      cat.blinking = !cat.blinking;
      cat.blinkTimer = cat.blinking ? 5 : (80 + Math.random() * 120);
    }

    // Meow bubble hide
    if (cat.meowTimer > 0) {
      cat.meowTimer--;
      if (cat.meowTimer === 0) bubble.classList.remove('visible');
    }

    // ─ Decide behavior based on mouse ─
    const GROUND = H - 14;
    cat.y = GROUND;

    if (mouseX !== null) {
      const dist = mouseX - cat.x;
      const absDist = Math.abs(dist);

      if (absDist < 6) {
        // Mouse directly on cat → sit and look
        if (cat.state !== 'sit') {
          cat.state = 'sit';
          cat.frame = 0;
          cat.frameTick = 0;
          if (Math.random() < 0.02) triggerMeow();
        }
        cat.sleeping = false;
        cat.sleepTimer = 0;
      } else if (absDist < 40) {
        // Walk toward cursor
        cat.dir = dist > 0 ? 1 : -1;
        cat.x  += cat.dir * 0.6;
        cat.state = 'walk';
        cat.frameSpeed = 6;
        cat.sleeping = false;
        cat.sleepTimer = 0;
      } else {
        // Run toward cursor
        cat.dir = dist > 0 ? 1 : -1;
        cat.x  += cat.dir * 2.2;
        cat.state = 'run';
        cat.frameSpeed = 3;
        cat.sleeping = false;
        cat.sleepTimer = 0;
      }
    } else {
      // No mouse — idle/roam/sleep
      cat.sleepTimer++;
      if (cat.sleepTimer > 300 && !cat.sleeping) {
        cat.sleeping = true;
        cat.state = 'sleep';
      }

      if (!cat.sleeping) {
        cat.idleTimer--;
        if (cat.idleTimer <= 0) {
          // Decide: idle or wander
          if (Math.random() < 0.4) {
            cat.state = 'walk';
            cat.dir   = Math.random() < 0.5 ? 1 : -1;
            cat.frameSpeed = 7;
            cat.idleTimer = 60 + Math.random() * 80;
          } else {
            cat.state = 'idle';
            cat.idleTimer = 80 + Math.random() * 120;
          }
        }
        if (cat.state === 'walk') {
          cat.x += cat.dir * 0.5;
        }
      } else {
        // Sleeping
        if (tick % 60 === 0) spawnZ();
      }
    }

    // Clamp position
    cat.x = Math.max(8, Math.min(W - 8, cat.x));

    // Advance animation frame
    if (cat.frameTick >= cat.frameSpeed) {
      cat.frameTick = 0;
      const wFrames = cat.state === 'run' ? 4 : 4;
      if (cat.state === 'walk' || cat.state === 'run') {
        cat.frame = (cat.frame + 1) % 4;
      } else if (cat.state === 'idle') {
        cat.frame = (cat.frame + 1) % 2;
      }
    }

    updateZ();
  }

  // ── Draw ground dots (retro floor) ───────────────────────
  function drawGround() {
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--border').trim() || 'rgba(240,237,230,0.08)';
    for (let x = 0; x < W; x += 4) {
      ctx.fillRect(x * SCALE, (H - 5) * SCALE, SCALE, SCALE);
    }
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGround();

    // Pick frame key
    let frameKey;
    if (cat.state === 'sleep') {
      frameKey = 'sleep';
    } else if (cat.state === 'sit') {
      frameKey = 'sit';
    } else if (cat.state === 'walk' || cat.state === 'run') {
      frameKey = WALK_FRAMES[cat.frame % 4];
    } else {
      frameKey = cat.blinking ? 'sit' : 'idle0'; // blink = eyes closed = sit frame approximation
    }

    const flip = cat.dir < 0;
    drawFrame(FRAMES[frameKey], Math.round(cat.x), Math.round(cat.y), flip);

    drawZ();
  }

  // ── Loop ──────────────────────────────────────────────────
  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  // ── Handle resize ─────────────────────────────────────────
  window.addEventListener('resize', () => {
    const newW = Math.floor(canvas.offsetWidth / SCALE);
    const newH = Math.floor(canvas.offsetHeight / SCALE);
    canvas.width  = newW * SCALE;
    canvas.height = newH * SCALE;
    ctx.imageSmoothingEnabled = false;
    cat.y = newH - 14;
    cat.x = Math.min(cat.x, newW - 8);
  });

  loop();
})();
