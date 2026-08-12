(() => {
  "use strict";

  // ============ Canvas & Resize ============
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const messageEl = document.getElementById("message");
  const startScreen = document.getElementById("start-screen");
  const gameOverScreen = document.getElementById("game-over");
  const finalScoreEl = document.getElementById("final-score");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  let W = 800, H = 600;
  let scale = 1;

  // Declared here (rather than down in the "Game State" section below) because
  // resize() needs to reference them and runs once synchronously at load time,
  // before that section would otherwise have executed.
  let players = [];
  let enemies = [];
  let snowballs = [];
  // Decorative snow-fort mounds (matches the reference art's terrain bumps).
  // Positions are stored as fractions of W/H so they stay correctly placed
  // across resizes without needing any rescaling logic of their own.
  let snowForts = [];

  // BUG FIX: resizing mid-game used to leave existing characters/snowballs at their
  // old pixel positions (and, since radius was baked in at spawn time, at their old
  // size too), so rotating a tablet or resizing the browser mid-match visibly broke
  // the layout. We now remember the previous W/H and rescale every live entity's
  // position proportionally; radius is a live getter (see Character/Snowball below)
  // so it always reflects the current `scale` without needing per-entity updates.
  function resize() {
    const prevW = W, prevH = H;
    // The game now sits inside a framed, centered page section (not a
    // fullscreen app), so it's bounded by the page's content width and a
    // comfortable viewport-height fraction rather than the full window.
    const maxW = Math.min(window.innerWidth - 40, 760);
    const maxH = Math.min(window.innerHeight * 0.62, 560);
    // 保持約 4:3 比例，適合經典遊戲
    const ratio = 4 / 3;
    if (maxW / maxH > ratio) {
      H = maxH;
      W = H * ratio;
    } else {
      W = maxW;
      H = W / ratio;
    }

    // BUG FIX: canvas backing store now matches devicePixelRatio so the game
    // renders crisply on retina/high-DPI screens instead of looking blurry.
    // All drawing code still works purely in logical W/H coordinates because
    // we scale the context to compensate (ctx.setTransform below).
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    scale = W / 800;

    if (prevW && prevH && (prevW !== W || prevH !== H)) {
      const sx = W / prevW, sy = H / prevH;
      [...players, ...enemies].forEach(c => { c.x *= sx; c.y *= sy; });
      snowballs.forEach(sb => { sb.x *= sx; sb.y *= sy; });
    }
  }
  window.addEventListener("resize", resize);
  resize();

  // ============ Audio (Web Audio API 合成) ============
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playTone(freq, duration, type = "sine", vol = 0.15, slideTo = null) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slideTo) {
      osc.frequency.linearRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
    }
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  // BUG FIX: assets/audio/*.mp3 shipped as part of the game's file structure
  // and the README advertised "Web Audio API 合成 + 可選 mp3 檔案" (synth +
  // optional mp3), but the code only ever called playTone() — the mp3 files
  // were never loaded or played anywhere. We now play the real mp3 first
  // (cloning the node so rapid overlapping plays, e.g. two hits in one frame,
  // don't cut each other off) and fall back to the original synthesized tone
  // if a file is missing, fails to decode, or playback is blocked for any
  // reason (sync throw or async promise rejection both handled).
  const SOUND_FILES = {
    throw: "assets/audio/throw.mp3",
    hit: "assets/audio/hit.mp3",
    splat: "assets/audio/splat.mp3",
    win: "assets/audio/win.mp3",
    lose: "assets/audio/lose.mp3"
  };
  const soundElements = {};
  Object.entries(SOUND_FILES).forEach(([key, src]) => {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = 0.55;
    soundElements[key] = audio;
  });

  function playFile(key, onFail) {
    const base = soundElements[key];
    if (!base) { onFail(); return; }
    try {
      const node = base.cloneNode(true);
      node.volume = base.volume;
      const p = node.play();
      if (p && typeof p.catch === "function") p.catch(onFail);
    } catch (e) {
      onFail();
    }
  }

  function playThrow() {
    ensureAudio();
    playFile("throw", () => playTone(180, 0.12, "triangle", 0.12, 90));
  }
  function playHit() {
    ensureAudio();
    playFile("hit", () => {
      playTone(120, 0.15, "square", 0.1);
      setTimeout(() => playTone(80, 0.2, "sawtooth", 0.08), 40);
    });
  }
  function playSplat() {
    ensureAudio();
    playFile("splat", () => playTone(60, 0.25, "sawtooth", 0.12, 30));
  }
  function playWin() {
    ensureAudio();
    playFile("win", () => {
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.2, "sine", 0.12), i * 120);
      });
    });
  }
  function playLose() {
    ensureAudio();
    playFile("lose", () => {
      [400, 320, 250, 180].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.25, "triangle", 0.12), i * 150);
      });
    });
  }

  // ============ Game State ============
  const STATE = {
    MENU: 0,
    PLAYING: 1,
    LEVEL_CLEAR: 2,
    GAME_OVER: 3
  };

  let gameState = STATE.MENU;
  let score = 0;
  let level = 1;
  let particles = [];
  let selectedPlayer = null;
  let chargeStart = 0;
  // BUG FIX: the charge-up ring used to visually fill up after 800ms, but the
  // actual throw-power formula kept scaling for another 400ms beyond that —
  // so a player releasing right when the ring looked "full" was not actually
  // getting the true max-power throw. Both now read from this one constant.
  const MAX_CHARGE_MS = 1200;
  let mouse = { x: 0, y: 0, down: false };
  let lastTime = 0;
  let messageTimer = 0;

  // ============ Character ============
  class Character {
    constructor(x, y, isPlayer) {
      this.x = x;
      this.y = y;
      this.isPlayer = isPlayer;
      this.hp = isPlayer ? 2 : 3;
      this.maxHp = this.hp;
      this.alive = true;
      this.hitFlash = 0;
      this.koTimer = 0;
      this.angle = isPlayer ? -Math.PI / 2 : Math.PI / 2; // 面向對方
      this.vx = 0;
      this.vy = 0;
      this.cooldown = 0;
      this.targetX = x;
      this.aiTimer = 0;
      this.throwPower = 0;
    }

    // BUG FIX: radius used to be baked in once at spawn time (`18 * scale`), so
    // a mid-game window resize left already-spawned characters at their old
    // size while new ones spawned at the new size — a visible inconsistency.
    // Making it a live getter means every character always reflects the
    // current `scale`, resize or not.
    get radius() {
      return 18 * scale;
    }
    get color() {
      return this.isPlayer ? "#c0392b" : "#27ae60";
    }
    get hatColor() {
      return this.isPlayer ? "#e74c3c" : "#2ecc71";
    }

    takeHit() {
      if (!this.alive) return;
      this.hp--;
      this.hitFlash = 0.35;
      playHit();
      if (this.hp <= 0) {
        this.alive = false;
        this.koTimer = 1.2;
        score += this.isPlayer ? 0 : 100 + level * 20;
        updateScore();
        // 粒子
        for (let i = 0; i < 12; i++) {
          particles.push({
            x: this.x, y: this.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            life: 0.6 + Math.random() * 0.4,
            color: this.hatColor
          });
        }
      }
    }

    update(dt) {
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (!this.alive) {
        this.koTimer -= dt;
        return;
      }
      if (this.cooldown > 0) this.cooldown -= dt;

      // 簡單物理阻尼
      this.vx *= 0.85;
      this.vy *= 0.85;
      this.x += this.vx;
      this.y += this.vy;

      // 邊界
      const margin = this.radius + 4;
      this.x = Math.max(margin, Math.min(W - margin, this.x));
      this.y = Math.max(margin + 30, Math.min(H - margin - 10, this.y));
    }

    // ART STYLE: matches the reference screenshot's minimal look — a single
    // flat team-colored oval (no separate hood/face color blocks) with two
    // small dark boots and two eye dots painted directly on the body. A
    // ground-level selection reticle (concentric flattened rings, matching
    // the reference's on-ground target circles under the active red unit)
    // plus orbiting sparkle stars while charging. Knocked-out characters
    // squash flat into a "splat" on the ground instead of fading out
    // standing upright.
    draw(ctx) {
      if (!this.alive && this.koTimer <= 0) return;
      const r = this.radius;

      ctx.save();
      ctx.translate(this.x, this.y);

      // Ground selection reticle — drawn first so it sits under the character.
      if (selectedPlayer === this) {
        const ringY = r * 0.85;
        ctx.save();
        ctx.globalAlpha = 0.8;
        [1, 0.65].forEach((k, i) => {
          ctx.beginPath();
          ctx.ellipse(0, ringY, r * 1.3 * k, r * 0.5 * k, 0, 0, Math.PI * 2);
          ctx.strokeStyle = i === 0 ? "rgba(255, 220, 60, 0.85)" : "rgba(255, 220, 60, 0.5)";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.stroke();
        });
        ctx.setLineDash([]);
        if (mouse.down) {
          const p = Math.min(1, (performance.now() - chargeStart) / MAX_CHARGE_MS);
          ctx.beginPath();
          ctx.ellipse(0, ringY, r * 1.3, r * 0.5, 0, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 150, 40, ${0.6 + p * 0.4})`;
          ctx.lineWidth = 3;
          ctx.stroke();
          // charge sparkle stars
          const starAngle = performance.now() * 0.006;
          for (let i = 0; i < 3; i++) {
            const a = starAngle + (i * Math.PI * 2) / 3;
            drawStar(ctx, Math.cos(a) * r * 1.5, ringY + Math.sin(a) * r * 0.55, 3.5 * (0.6 + p * 0.4), "rgba(120, 190, 255, 0.9)");
          }
        }
        ctx.restore();
      }

      if (!this.alive) {
        // Knocked out: squash into a flat splat on the ground instead of
        // standing there fading — matches the "melted" look in the reference.
        const squash = 1 - Math.max(0, Math.min(1, this.koTimer / 1.2));
        const flat = 0.22 + 0.78 * (1 - squash);
        ctx.globalAlpha = Math.max(0, Math.min(1, this.koTimer / 0.3));
        ctx.beginPath();
        ctx.ellipse(0, r * 0.6, r * (0.95 + squash * 0.35), r * 0.55 * flat, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, r * 0.5, r * 0.4, r * 0.28 * flat, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#fefefe";
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1.5;
        const s = r * 0.12;
        [[-0.16, 0], [0.16, 0]].forEach(([ox, oy]) => {
          const cy = r * 0.5 + oy * flat;
          ctx.beginPath();
          ctx.moveTo(ox * r - s, cy - s * flat);
          ctx.lineTo(ox * r + s, cy + s * flat);
          ctx.moveTo(ox * r + s, cy - s * flat);
          ctx.lineTo(ox * r - s, cy + s * flat);
          ctx.stroke();
        });
        ctx.restore();
        return;
      }

      const flash = this.hitFlash > 0;

      // 陰影
      ctx.beginPath();
      ctx.ellipse(0, r * 0.95, r * 0.6, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fill();

      // 腳 (兩個小小的深藍色橢圓，貼在身體下方，比照參考圖)
      ctx.fillStyle = "#22335a";
      [-0.28, 0.28].forEach(ox => {
        ctx.beginPath();
        ctx.ellipse(ox * r, r * 0.8, r * 0.2, r * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // 身體 — 單一團隊色的圓潤橢圓（不分帽子/臉部色塊，比照參考圖的極簡造型）
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.05, r * 0.78, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fillStyle = flash ? "#fff" : this.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 眼睛（直接畫在身體色塊上，不另外畫白色臉部區塊）
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.08, r * 0.1, 0, Math.PI * 2);
      ctx.arc(r * 0.22, -r * 0.08, r * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // HP 指示（小點）
      if (this.hp < this.maxHp) {
        ctx.fillStyle = "rgba(255,200,50,0.9)";
        for (let i = 0; i < this.hp; i++) {
          ctx.beginPath();
          ctx.arc(-r * 0.3 + i * r * 0.3, -r * 1.2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  // 4 角星形裝飾（充能特效用）
  function drawStar(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * size * 0.35, Math.sin(a + Math.PI / 4) * size * 0.35);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // ============ Snowball ============
  class Snowball {
    constructor(x, y, vx, vy, fromPlayer) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.fromPlayer = fromPlayer;
      this.alive = true;
      this.trail = [];
    }

    // BUG FIX: same stale-size-after-resize issue as Character.radius above.
    get radius() {
      return 7 * scale;
    }

    update(dt) {
      if (!this.alive) return;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 6) this.trail.shift();

      this.vy += 380 * dt * scale; // 重力
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // 出界
      if (this.x < -20 || this.x > W + 20 || this.y > H + 30) {
        this.alive = false;
        playSplat();
      }
    }

    draw(ctx) {
      if (!this.alive) return;
      // 軌跡
      this.trail.forEach((t, i) => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, this.radius * (0.3 + i * 0.1), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.15 + i * 0.08})`;
        ctx.fill();
      });
      // 本體
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "rgba(180,200,220,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ============ Setup Level ============
  function setupLevel() {
    players = [];
    enemies = [];
    snowballs = [];
    particles = [];
    selectedPlayer = null;

    const playerCount = 3;
    const spacing = W / (playerCount + 1);
    for (let i = 0; i < playerCount; i++) {
      const p = new Character(spacing * (i + 1), H - 70 * scale, true);
      players.push(p);
    }

    // 敵人數量：level 1 = 3, 之後增加
    const enemyCount = Math.min(3 + (level - 1) * 2, 18);
    const eSpacing = W / (enemyCount + 1);
    for (let i = 0; i < enemyCount; i++) {
      const e = new Character(eSpacing * (i + 1) + (Math.random() - 0.5) * 20, 80 * scale + Math.random() * 40, false);
      enemies.push(e);
    }

    // 雪堡地形裝飾（純視覺，不影響碰撞），數量隨關卡略增
    snowForts = [];
    const fortCount = 2 + Math.min(2, Math.floor(level / 2));
    for (let i = 0; i < fortCount; i++) {
      snowForts.push({
        fx: 0.12 + Math.random() * 0.76,
        fy: 0.2 + Math.random() * 0.35,
        size: 0.8 + Math.random() * 0.6
      });
    }

    levelEl.textContent = `Level ${level}`;
    showMessage(`Level ${level}`, 1.2);
  }

  function updateScore() {
    scoreEl.textContent = score;
  }

  function showMessage(text, duration = 1.5) {
    messageEl.textContent = text;
    messageEl.classList.remove("hidden");
    messageTimer = duration;
  }

  // ============ AI ============
  function updateAI(dt) {
    const alivePlayers = players.filter(p => p.alive);
    if (alivePlayers.length === 0) return;

    enemies.forEach(e => {
      if (!e.alive || e.cooldown > 0) return;

      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        e.aiTimer = 0.6 + Math.random() * 1.2;

        // 隨機移動或瞄準
        if (Math.random() < 0.4) {
          e.targetX = 40 + Math.random() * (W - 80);
        }

        // 投擲
        // BUG FIX: this used to compute `timeEst` ("簡單拋物線預測") and then
        // never use it — vx/vy were derived from direction+speed alone with no
        // real gravity compensation, so enemies routinely lobbed short/long
        // regardless of distance. We now solve the exact kinematics for the
        // gravity constant Snowball.update() actually applies (380 * scale
        // px/s²), so a throw with zero inaccuracy lands exactly on the target;
        // `inaccuracy` (shrinking as level rises) is added back afterwards so
        // higher levels get visibly better-aimed enemies.
        if (Math.random() < 0.55 && alivePlayers.length) {
          const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
          const dx = target.x - e.x;
          const dy = target.y - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          const g = 380 * scale;
          const refSpeed = (260 + Math.random() * 160 + level * 12) * scale;
          const t = Math.max(0.35, Math.min(1.4, dist / refSpeed));
          const vx = dx / t;
          const vy = (dy - 0.5 * g * t * t) / t;
          const inaccuracy = Math.max(0, 36 - level * 2) * scale;
          snowballs.push(new Snowball(
            e.x, e.y + 5,
            vx + (Math.random() - 0.5) * inaccuracy,
            vy + (Math.random() - 0.5) * inaccuracy * 0.5,
            false
          ));
          e.cooldown = 1.1 + Math.random() * 0.6 - level * 0.03;
          playThrow();
        }
      }

      // 移動向目標
      const dx = e.targetX - e.x;
      if (Math.abs(dx) > 8) {
        e.vx += Math.sign(dx) * 120 * dt * scale;
      }
    });
  }

  // ============ Collision ============
  function checkCollisions() {
    snowballs.forEach(sb => {
      if (!sb.alive) return;
      const targets = sb.fromPlayer ? enemies : players;
      targets.forEach(c => {
        if (!c.alive) return;
        const dx = sb.x - c.x;
        const dy = sb.y - c.y;
        if (dx * dx + dy * dy < (sb.radius + c.radius) ** 2) {
          sb.alive = false;
          c.takeHit();
          // 小粒子
          for (let i = 0; i < 6; i++) {
            particles.push({
              x: sb.x, y: sb.y,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              life: 0.35,
              color: "#fff"
            });
          }
        }
      });
    });
  }

  // ============ Input ============
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    // BUG FIX: now that canvas.width/height are in device pixels (see resize(),
    // devicePixelRatio scaling), mapping through canvas.width/rect.width would
    // return coordinates in device-pixel space instead of the logical W/H space
    // every game object uses — clicks would land in the wrong place on any
    // non-1x display. Map through the logical W/H instead.
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height)
    };
  }

  function onDown(e) {
    if (gameState !== STATE.PLAYING) return;
    e.preventDefault();
    ensureAudio();
    const pos = getPos(e);
    mouse.x = pos.x;
    mouse.y = pos.y;
    mouse.down = true;

    // 找最近的玩家
    let closest = null;
    let minD = 50 * scale;
    players.forEach(p => {
      if (!p.alive) return;
      const d = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (d < minD) {
        minD = d;
        closest = p;
      }
    });
    if (closest) {
      selectedPlayer = closest;
      chargeStart = performance.now();
    }
  }

  function onMove(e) {
    if (gameState !== STATE.PLAYING) return;
    e.preventDefault();
    const pos = getPos(e);
    mouse.x = pos.x;
    mouse.y = pos.y;
    if (selectedPlayer && mouse.down && selectedPlayer.alive) {
      // 移動角色
      selectedPlayer.x += (pos.x - selectedPlayer.x) * 0.35;
      selectedPlayer.y += (pos.y - selectedPlayer.y) * 0.35;
      // 限制在下半場
      selectedPlayer.y = Math.max(H * 0.45, Math.min(H - 40 * scale, selectedPlayer.y));
    }
  }

  function onUp(e) {
    if (gameState !== STATE.PLAYING) return;
    e.preventDefault();
    if (selectedPlayer && mouse.down && selectedPlayer.alive) {
      const holdTime = Math.min(MAX_CHARGE_MS, performance.now() - chargeStart) / 1000;
      const power = 220 + holdTime * 380;
      const dx = mouse.x - selectedPlayer.x;
      const dy = mouse.y - selectedPlayer.y;
      const dist = Math.hypot(dx, dy) || 1;
      // 方向稍微向上
      const angle = Math.atan2(dy, dx);
      const speed = power * scale;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 80 * scale;
      snowballs.push(new Snowball(selectedPlayer.x, selectedPlayer.y - 8, vx, vy, true));
      playThrow();
      selectedPlayer.cooldown = 0.3;
    }
    mouse.down = false;
    selectedPlayer = null;
  }

  canvas.addEventListener("mousedown", onDown);
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseup", onUp);
  canvas.addEventListener("mouseleave", onUp);
  canvas.addEventListener("touchstart", onDown, { passive: false });
  canvas.addEventListener("touchmove", onMove, { passive: false });
  canvas.addEventListener("touchend", onUp);
  canvas.addEventListener("touchcancel", onUp);

  // ============ Game Loop ============
  function update(dt) {
    if (gameState !== STATE.PLAYING) return;

    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) messageEl.classList.add("hidden");
    }

    players.forEach(p => p.update(dt));
    enemies.forEach(e => e.update(dt));
    snowballs.forEach(sb => sb.update(dt));
    snowballs = snowballs.filter(sb => sb.alive);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);

    updateAI(dt);
    checkCollisions();

    // 勝利 / 失敗檢查
    const aliveEnemies = enemies.filter(e => e.alive).length;
    const alivePlayers = players.filter(p => p.alive).length;

    if (aliveEnemies === 0) {
      gameState = STATE.LEVEL_CLEAR;
      playWin();
      score += 500 + level * 100;
      updateScore();
      showMessage("過關！", 1.5);
      setTimeout(() => {
        level++;
        setupLevel();
        gameState = STATE.PLAYING;
      }, 1600);
    } else if (alivePlayers === 0) {
      gameState = STATE.GAME_OVER;
      playLose();
      finalScoreEl.textContent = `分數：${score}`;
      gameOverScreen.classList.remove("hidden");
    }
  }

  function drawBackground() {
    // 雪地漸層已由 CSS 提供，這裡畫一些雪花與地平線
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + Date.now() * 0.01) % W;
      const y = (i * 53) % H;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 地面微微陰影
    const grd = ctx.createLinearGradient(0, H * 0.7, 0, H);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(1, "rgba(220,235,245,0.5)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, H * 0.7, W, H * 0.3);

    // 雪堡地形（純裝飾，比照參考圖的地面雪丘）
    snowForts.forEach(f => {
      const x = f.fx * W, y = f.fy * H;
      const s = f.size * 26 * scale;
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.3, s, s * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.62, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#f3f8fc";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - s * 0.15, y - s * 0.15, s * 0.55, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "rgba(180,200,220,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    // 排序：先畫遠的（y 小）
    const allChars = [...enemies, ...players].filter(c => c.alive || c.koTimer > 0);
    allChars.sort((a, b) => a.y - b.y);
    allChars.forEach(c => c.draw(ctx));

    snowballs.forEach(sb => sb.draw(ctx));

    // 粒子
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // 蓄力提示線（從角色到滑鼠）
    if (selectedPlayer && mouse.down && selectedPlayer.alive) {
      ctx.beginPath();
      ctx.moveTo(selectedPlayer.x, selectedPlayer.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.strokeStyle = "rgba(255, 200, 80, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function loop(ts) {
    const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0.016);
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ============ Start / Restart ============
  function startGame() {
    ensureAudio();
    score = 0;
    level = 1;
    updateScore();
    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    setupLevel();
    gameState = STATE.PLAYING;
  }

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  // 初始
  requestAnimationFrame(loop);
})();
