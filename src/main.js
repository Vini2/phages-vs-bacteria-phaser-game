/* Phages vs Bacteria - Phaser 3 starter
   - Procedural assets: no image files required
   - Tap/click bacteria to attach, inject timer fills, bacterium lyses, you replicate
   - Difficulty:
     * Bacteria reproduction ramps with time + population
     * Spawn fewer helper phages
     * Most helpers only swarm/harass
     * A small fraction of helpers ("killer") can occasionally lyse (rare + long cooldown)
*/

const W = 960;
const H = 540;

const CONFIG = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#081018",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H
  },
  physics: {
    default: "arcade",
    arcade: { debug: false }
  },
  scene: [BootScene, GameScene]
};

new Phaser.Game(CONFIG);

/* ---------------------------- Boot Scene ---------------------------- */
function BootScene() {
  Phaser.Scene.call(this, { key: "BootScene" });
}
BootScene.prototype = Object.create(Phaser.Scene.prototype);
BootScene.prototype.constructor = BootScene;

BootScene.prototype.preload = function () {
  // No external loads.
};

BootScene.prototype.create = function () {
  makeTextures(this);
  this.scene.start("GameScene");
};

/* ---------------------------- Game Scene ---------------------------- */
function GameScene() {
  Phaser.Scene.call(this, { key: "GameScene" });
}
GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.create = function () {
  this.center = new Phaser.Math.Vector2(W / 2, H / 2);
  this.dishRadius = Math.min(W, H) * 0.44;

  // State
  this.score = 0;
  this.neededToWin = 35;
  this.loseThreshold = 55;
  this.gameOver = false;

  // Helpers (fewer + weaker)
  this.maxHelpers = 8;
  this.spawnChance2nd = 0.08;

  // A small fraction of helpers can lyse (keeps player as main actor)
  this.killerHelperChance = 0.80;      // 90% of spawned helpers are "killer"
  this.killerLysisChancePerSec = 0.3; // 30% probability while in range (per second)

  // Groups
  this.bacteria = this.physics.add.group();
  this.helpers = this.physics.add.group();
  this.particles = this.add.particles(0, 0, "particle", {
    speed: { min: 40, max: 160 },
    lifespan: { min: 250, max: 600 },
    quantity: 0,
    scale: { start: 0.8, end: 0 },
    emitting: false
  });

  // Background
  this.dish = this.add.image(this.center.x, this.center.y, "dish").setDepth(-10);
  this.vignette = this.add.image(this.center.x, this.center.y, "vignette").setDepth(1000).setAlpha(0.6);

  // Player
  this.player = this.physics.add.sprite(this.center.x, this.center.y, "phage");
  this.player.setDamping(true);
  this.player.setDrag(0.92);
  this.player.setMaxVelocity(320);
  this.player.setCollideWorldBounds(false);

  // UI
  this.uiText = this.add.text(16, 14, "", {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    fontSize: "16px",
    color: "#cfe7ff"
  });

  this.hintText = this.add.text(16, 36, "Tap/click a bacterium to attach → inject → lyse → replicate", {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    fontSize: "14px",
    color: "#9cc6ff"
  }).setAlpha(0.9);

  // Injection UI
  this.injectRing = this.add.image(0, 0, "injectRing").setVisible(false);
  this.injectFill = this.add.image(0, 0, "injectFill").setVisible(false);

  // Input
  this.cursors = this.input.keyboard.createCursorKeys();
  this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE");

  this.input.on("pointerdown", (p) => {
    if (this.gameOver || this.tutorialActive) return;
    this.tryAttachAt(p.worldX, p.worldY);
  });

  // Initial bacteria
  for (let i = 0; i < 10; i++) this.spawnBacterium();

  // Bacteria reproduction (ramps with time + population)
  this.elapsedSeconds = 0;
  this.reproEvent = this.time.addEvent({
    delay: 1000,
    loop: true,
    callback: () => {
      if (this.gameOver || this.tutorialActive) return;

      const n = this.bacteria.countActive(true);

      const timeRamp = Phaser.Math.Clamp(this.elapsedSeconds / 40, 0, 2.2);
      const popRamp  = Phaser.Math.Clamp(n / 22, 0, 2.0);

      const attempts = 2 + Math.floor(timeRamp + popRamp); // ~2..6
      for (let i = 0; i < attempts; i++) {
        const chance = Phaser.Math.Clamp(0.30 + 0.16 * timeRamp + 0.14 * popRamp, 0.30, 0.92);
        if (Math.random() < chance && n < 110) {
          this.spawnBacteriumNearExisting();
        }
      }
    }
  });

  // Injection state
  this.attachedTarget = null;
  this.injecting = false;
  this.injectStartTime = 0;
  this.baseInjectDuration = 950;
  this.injectDuration = this.baseInjectDuration;
  this.attachRange = 92;

  // Hint fade
  this.tweens.add({
    targets: this.hintText,
    alpha: 0.0,
    delay: 6500,
    duration: 1200,
    ease: "Sine.easeOut"
  });

  this.physics.world.setBounds(0, 0, W, H);

  // Tutorial
  this.startTutorial();
};

GameScene.prototype.startTutorial = function () {
  this.tutorialActive = true;
  this.tutorialStep = 0;

  this.tutorialOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0x000000, 0.55)
    .setDepth(2000)
    .setInteractive();

  this.tutorialPanel = this.add.image(W / 2, H / 2 + 120, "panel")
    .setDepth(2001)
    .setAlpha(0.96);

  const baseStyle = {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#e8f3ff",
    align: "center",
    wordWrap: { width: 640 }
  };

  this.tutorialTitle = this.add.text(W / 2, H / 2 + 60, "", {
    ...baseStyle, fontSize: "28px"
  }).setOrigin(0.5).setDepth(2002);

  this.tutorialBody = this.add.text(W / 2, H / 2 + 110, "", {
    ...baseStyle, fontSize: "16px", color: "#b8d7ff"
  }).setOrigin(0.5).setDepth(2002);

  this.tutorialHint = this.add.text(W / 2, H / 2 + 165, "Tap/click to continue  •  Space also works", {
    ...baseStyle, fontSize: "14px", color: "#9cc6ff"
  }).setOrigin(0.5).setDepth(2002).setAlpha(0.9);

  this.tutorialPointer = this.add.image(this.center.x, this.center.y, "shock")
    .setDepth(2002)
    .setAlpha(0.55)
    .setScale(0.55);

  this.tweens.add({
    targets: this.tutorialPointer,
    scale: { from: 0.45, to: 0.65 },
    alpha: { from: 0.35, to: 0.65 },
    duration: 650,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut"
  });

  this._tutorialAdvance = () => {
    if (!this.tutorialActive) return;
    this.tutorialStep++;
    this.renderTutorialStep();
  };

  this.tutorialOverlay.on("pointerdown", this._tutorialAdvance);

  this.tutorialKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  this.tutorialKey.on("down", this._tutorialAdvance);

  this.renderTutorialStep();
};

GameScene.prototype.renderTutorialStep = function () {
  const step = this.tutorialStep;
  const pointAt = (x, y) => this.tutorialPointer.setPosition(x, y);

  const firstBacterium = this.bacteria.getChildren().find(b => b && b.active);

  if (step === 0) {
    this.tutorialTitle.setText("Phages vs Bacteria");
    this.tutorialBody.setText("You are a phage in a petri dish.\nClear enough bacteria before they multiply out of control.");
    pointAt(this.center.x, this.center.y);

  } else if (step === 1) {
    this.tutorialTitle.setText("Move");
    this.tutorialBody.setText("Use WASD / Arrow keys to swim around.\n(You must get close to attach.)");
    pointAt(this.player.x, this.player.y);

  } else if (step === 2) {
    this.tutorialTitle.setText("Attach");
    this.tutorialBody.setText("Tap/click a bacterium while you're close.\nYou will attach to it.");
    if (firstBacterium) pointAt(firstBacterium.x, firstBacterium.y);
    else pointAt(this.center.x + 120, this.center.y);

  } else if (step === 3) {
    this.tutorialTitle.setText("Inject DNA");
    this.tutorialBody.setText("A short timer fills while you inject.\nStay attached until it completes.");
    if (firstBacterium) pointAt(firstBacterium.x, firstBacterium.y);
    else pointAt(this.center.x + 120, this.center.y);

  } else if (step === 4) {
    this.tutorialTitle.setText("Lyse + Replicate");
    this.tutorialBody.setText("When injection finishes, the bacterium bursts (lysis).\nYou gain points and spawn extra phages.");
    pointAt(this.center.x - 120, this.center.y);

  } else if (step === 5) {
    this.tutorialTitle.setText("Win / Lose");
    this.tutorialBody.setText(`Win: reach ${this.neededToWin} lysis points.\nLose: if bacteria overrun the dish.`);
    pointAt(this.center.x, this.center.y);

  } else {
    this.endTutorial();
  }
};

GameScene.prototype.endTutorial = function () {
  this.tutorialActive = false;

  if (this.tutorialOverlay) this.tutorialOverlay.destroy();
  if (this.tutorialPanel) this.tutorialPanel.destroy();
  if (this.tutorialTitle) this.tutorialTitle.destroy();
  if (this.tutorialBody) this.tutorialBody.destroy();
  if (this.tutorialHint) this.tutorialHint.destroy();
  if (this.tutorialPointer) this.tutorialPointer.destroy();

  if (this.tutorialKey) {
    this.tutorialKey.off("down", this._tutorialAdvance);
    this.tutorialKey.destroy();
  }

  this.hintText.setAlpha(0.9);
  this.tweens.add({ targets: this.hintText, alpha: 0, delay: 4500, duration: 900 });
};

GameScene.prototype.update = function (t, dtMs) {
  if (this.tutorialActive) return;
  if (this.gameOver) return;

  this.elapsedSeconds += dtMs / 1000;
  const dt = dtMs / 1000;

  this.handleMovement(dt);
  this.constrainToDish(this.player);

  this.helpers.children.iterate((h) => {
    if (!h || !h.active) return;
    helperBrain(this, h, dt);
    this.constrainToDish(h);
  });

  this.bacteria.children.iterate((b) => {
    if (!b || !b.active) return;
    bacteriaDrift(this, b, dt);
    this.constrainToDish(b);
  });

  if (this.injecting && this.attachedTarget && this.attachedTarget.active) {
    const elapsed = t - this.injectStartTime;
    const p = Phaser.Math.Clamp(elapsed / this.injectDuration, 0, 1);

    this.player.body.setVelocity(0, 0);
    this.player.x = this.attachedTarget.x;
    this.player.y = this.attachedTarget.y;

    this.injectRing.setVisible(true).setPosition(this.attachedTarget.x, this.attachedTarget.y).setAlpha(0.85);
    this.injectFill.setVisible(true).setPosition(this.attachedTarget.x, this.attachedTarget.y).setAlpha(0.95);

    this.injectFill.setScale(0.6 + 0.8 * p);

    if (p >= 1) {
      this.lysis(this.attachedTarget);
      this.stopInjecting();
    }
  } else if (this.injecting) {
    this.stopInjecting();
  }

  const alive = this.bacteria.countActive(true);
  if (this.score >= this.neededToWin) {
    this.endGame(true);
  } else if (alive >= this.loseThreshold) {
    this.endGame(false);
  }

  this.uiText.setText(
    `Score: ${this.score}/${this.neededToWin}   Bacteria: ${alive}   Phages: ${1 + this.helpers.countActive(true)}`
  );
};

GameScene.prototype.handleMovement = function (dt) {
  if (this.injecting) return;

  const speed = 520;
  let ax = 0, ay = 0;

  const left = this.cursors.left.isDown || this.keys.A.isDown;
  const right = this.cursors.right.isDown || this.keys.D.isDown;
  const up = this.cursors.up.isDown || this.keys.W.isDown;
  const down = this.cursors.down.isDown || this.keys.S.isDown;

  if (left) ax -= 1;
  if (right) ax += 1;
  if (up) ay -= 1;
  if (down) ay += 1;

  const v = new Phaser.Math.Vector2(ax, ay);
  if (v.lengthSq() > 0) v.normalize().scale(speed);

  this.player.body.setAcceleration(v.x, v.y);

  const vel = this.player.body.velocity;
  if (vel.lengthSq() > 20) {
    this.player.rotation = Phaser.Math.Angle.RotateTo(
      this.player.rotation,
      Phaser.Math.Angle.Between(0, 0, vel.x, vel.y),
      6 * dt
    );
  }
};

GameScene.prototype.tryAttachAt = function (x, y) {
  if (this.injecting) return;

  let best = null;
  let bestD2 = Infinity;

  this.bacteria.children.iterate((b) => {
    if (!b || !b.active) return;
    const d2 = Phaser.Math.Distance.Squared(x, y, b.x, b.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = b;
    }
  });

  if (!best) return;

  const distToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, best.x, best.y);
  if (distToPlayer > this.attachRange) {
    this.tweens.add({ targets: best, scale: 1.18, yoyo: true, duration: 90 });
    return;
  }

  this.startInjecting(best);
};

GameScene.prototype.startInjecting = function (bacterium) {
  if (!bacterium || !bacterium.active) return;

  this.attachedTarget = bacterium;
  this.injecting = true;

  const n = this.bacteria.countActive(true);
  this.injectDuration = this.baseInjectDuration + Math.min(900, n * 18);

  this.injectStartTime = this.time.now;

  bacterium.setData("infected", true);
  this.tweens.add({
    targets: bacterium,
    angle: { from: -4, to: 4 },
    duration: 70,
    yoyo: true,
    repeat: 8
  });

  this.tweens.add({ targets: this.player, scale: 1.12, yoyo: true, duration: 120 });
};

GameScene.prototype.stopInjecting = function () {
  this.injecting = false;
  if (this.attachedTarget) this.attachedTarget.setData("infected", false);
  this.attachedTarget = null;
  this.injectRing.setVisible(false);
  this.injectFill.setVisible(false);
  this.injectFill.setScale(1);
};

GameScene.prototype.lysis = function (b) {
  if (!b || !b.active) return;

  this.particles.emitParticleAt(b.x, b.y, 26);
  b.disableBody(true, true);

  this.score += 1;

  // Spawn 2 helper phages per lysis (capped)
  for (let i = 0; i < 2; i++) {
    if (this.helpers.countActive(true) >= this.maxHelpers) break;
    this.spawnHelperPhageNear(b.x, b.y);
  }

  const shock = this.add.image(b.x, b.y, "shock").setAlpha(0.7);
  shock.setScale(0.2);
  this.tweens.add({
    targets: shock,
    scale: 1.2,
    alpha: 0,
    duration: 320,
    ease: "Sine.easeOut",
    onComplete: () => shock.destroy()
  });
};

GameScene.prototype.spawnBacterium = function () {
  const p = randomPointInDish(this.center, this.dishRadius * 0.92);
  const b = this.bacteria.create(p.x, p.y, "bacterium");
  b.setCircle(16);
  b.setBounce(0.8);
  b.setDrag(0.2, 0.2);
  b.setMaxVelocity(85);
  b.setData("infected", false);

  b.body.setVelocity(Phaser.Math.Between(-45, 45), Phaser.Math.Between(-45, 45));
  b.setScale(Phaser.Math.FloatBetween(0.85, 1.15));
  b.setAlpha(Phaser.Math.FloatBetween(0.85, 1.0));

  return b;
};

GameScene.prototype.spawnBacteriumNearExisting = function () {
  const list = this.bacteria.getChildren().filter((x) => x.active);
  if (list.length === 0) return this.spawnBacterium();

  const parent = Phaser.Utils.Array.GetRandom(list);
  const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
  const r = Phaser.Math.FloatBetween(18, 44);
  const p = new Phaser.Math.Vector2(parent.x + Math.cos(angle) * r, parent.y + Math.sin(angle) * r);

  const clamped = clampToDishPoint(this.center, this.dishRadius * 0.92, p);

  const b = this.bacteria.create(clamped.x, clamped.y, "bacterium");
  b.setCircle(16);
  b.setBounce(0.8);
  b.setDrag(0.2, 0.2);
  b.setMaxVelocity(85);
  b.setData("infected", false);
  b.body.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-40, 40));

  b.setScale(0.2);
  this.tweens.add({ targets: b, scale: Phaser.Math.FloatBetween(0.85, 1.15), duration: 180, ease: "Back.easeOut" });

  return b;
};

GameScene.prototype.spawnHelperPhageNear = function (x, y) {
  const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
  const r = Phaser.Math.FloatBetween(10, 30);
  const p = new Phaser.Math.Vector2(x + Math.cos(angle) * r, y + Math.sin(angle) * r);

  const h = this.helpers.create(p.x, p.y, "helper");
  h.setCircle(12);
  h.setDamping(true);
  h.setDrag(0.90);
  h.setMaxVelocity(190);
  h.setScale(Phaser.Math.FloatBetween(0.85, 1.05));
  h.setAlpha(0.95);

  h.setData("wanderAngle", Phaser.Math.FloatBetween(0, Math.PI * 2));

  // Only some helpers are allowed to lyse (rarely)
  const isKiller = Math.random() < this.killerHelperChance;
  h.setData("killer", isKiller);
  h.setData("cooldown", 0);

  // Optional: subtle tint so you can notice them
  if (isKiller) h.setTint(0xffc45a);

  return h;
};

GameScene.prototype.constrainToDish = function (sprite) {
  const pos = new Phaser.Math.Vector2(sprite.x, sprite.y);
  const to = pos.clone().subtract(this.center);
  const maxR = this.dishRadius * 0.93;

  if (to.length() > maxR) {
    to.setLength(maxR);
    sprite.x = this.center.x + to.x;
    sprite.y = this.center.y + to.y;

    const v = sprite.body.velocity.clone();
    const n = to.clone().normalize();
    const dot = v.x * n.x + v.y * n.y;
    v.x = v.x - 2 * dot * n.x;
    v.y = v.y - 2 * dot * n.y;
    sprite.body.setVelocity(v.x * 0.65, v.y * 0.65);
  }
};

GameScene.prototype.endGame = function (won) {
  this.gameOver = true;
  this.stopInjecting();

  const banner = this.add.image(this.center.x, this.center.y, "panel").setAlpha(0.92);
  const title = won ? "YOU WIN" : "YOU LOSE";
  const subtitle = won
    ? "You cleared enough bacteria before they overran the dish."
    : "Bacteria overran the dish. Try attaching faster!";

  this.add.text(this.center.x, this.center.y - 26, title, {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    fontSize: "40px",
    color: "#e8f3ff"
  }).setOrigin(0.5);

  this.add.text(this.center.x, this.center.y + 14, subtitle, {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    fontSize: "16px",
    color: "#b8d7ff",
    align: "center",
    wordWrap: { width: 640 }
  }).setOrigin(0.5);

  this.add.text(this.center.x, this.center.y + 56, "Click/tap to restart", {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    fontSize: "14px",
    color: "#9cc6ff"
  }).setOrigin(0.5);

  banner.setScale(0.1);
  this.tweens.add({ targets: banner, scale: 1, duration: 260, ease: "Back.easeOut" });

  this.input.once("pointerdown", () => this.scene.restart());
};

/* ---------------------------- Behaviors ---------------------------- */

function bacteriaDrift(scene, b, dt) {
  const infected = b.getData("infected") === true;
  const max = infected ? 45 : 85;

  const v = b.body.velocity;
  const jitter = infected ? 10 : 18;

  b.body.setVelocity(
    Phaser.Math.Clamp(v.x + Phaser.Math.FloatBetween(-jitter, jitter) * dt, -max, max),
    Phaser.Math.Clamp(v.y + Phaser.Math.FloatBetween(-jitter, jitter) * dt, -max, max)
  );

  b.rotation += (infected ? 0.5 : 0.2) * dt;
}

function helperBrain(scene, h, dt) {
  // Helpers mostly swarm. A small subset ("killer") can occasionally lyse.

  let target = null;
  let bestD2 = 999999;

  const hx = h.x, hy = h.y;

  scene.bacteria.children.iterate((b) => {
    if (!b || !b.active) return;
    if (b.getData("infected")) return; // don't interfere with player's current injection

    const d2 = Phaser.Math.Distance.Squared(hx, hy, b.x, b.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      target = b;
    }
  });

  const isKiller = h.getData("killer") === true;
  let cooldown = h.getData("cooldown") || 0;
  cooldown = Math.max(0, cooldown - dt);
  h.setData("cooldown", cooldown);

  // Movement: seek + orbit
  if (target && bestD2 < 320 * 320) {
    const to = new Phaser.Math.Vector2(target.x - hx, target.y - hy).normalize().scale(260);
    h.body.setAcceleration(to.x, to.y);

    if (bestD2 < 70 * 70) {
      const tangent = new Phaser.Math.Vector2(-(target.y - hy), target.x - hx).normalize().scale(160);
      h.body.setAcceleration(tangent.x, tangent.y);
    }

    h.rotation = Phaser.Math.Angle.RotateTo(
      h.rotation,
      Phaser.Math.Angle.Between(hx, hy, target.x, target.y),
      6 * dt
    );
  } else {
    // Wander
    let a = h.getData("wanderAngle") || 0;
    a += Phaser.Math.FloatBetween(-0.9, 0.9) * dt;
    h.setData("wanderAngle", a);

    const force = new Phaser.Math.Vector2(Math.cos(a), Math.sin(a)).scale(160);
    h.body.setAcceleration(force.x, force.y);
    h.rotation = Phaser.Math.Angle.RotateTo(h.rotation, a, 3.5 * dt);
  }

  // Killer behavior: rare lysis, only when very close, with long cooldown
  if (isKiller && target && cooldown <= 0 && bestD2 < 34 * 34) {
    // convert per-second probability into per-frame
    const p = Phaser.Math.Clamp(scene.killerLysisChancePerSec * dt, 0, 1);

    if (Math.random() < p) {
      scene.lysis(target);
      h.setData("cooldown", 1.5); // long cooldown so it doesn't dominate

      // recoil away so it doesn't chain-kill
      const away = new Phaser.Math.Vector2(hx - target.x, hy - target.y).normalize().scale(220);
      h.body.setVelocity(away.x, away.y);
    }
  }
}

/* ---------------------------- Geometry Helpers ---------------------------- */

function randomPointInDish(center, radius) {
  const t = Math.random() * Math.PI * 2;
  const u = Math.random() + Math.random();
  const r = u > 1 ? 2 - u : u;
  return {
    x: center.x + Math.cos(t) * r * radius,
    y: center.y + Math.sin(t) * r * radius
  };
}

function clampToDishPoint(center, radius, pointVec) {
  const to = pointVec.clone().subtract(center);
  if (to.length() <= radius) return pointVec;
  to.setLength(radius);
  return new Phaser.Math.Vector2(center.x + to.x, center.y + to.y);
}

/* ---------------------------- Procedural Textures ---------------------------- */

function makeTextures(scene) {
  function tex(key, w, h, drawFn) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    drawFn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  // Petri dish background
  tex("dish", W, H, (g) => {
    g.fillStyle(0x07101a, 1);
    g.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.44;

    g.fillStyle(0x0c2233, 1);
    g.fillCircle(cx, cy, R + 18);

    g.fillStyle(0x0b1b28, 1);
    g.fillCircle(cx, cy, R + 8);

    g.fillStyle(0x0b2432, 1);
    g.fillCircle(cx, cy, R);

    for (let i = 0; i < 220; i++) {
      const p = randomPointInDish({ x: cx, y: cy }, R);
      const a = Phaser.Math.FloatBetween(0.04, 0.14);
      const r = Phaser.Math.FloatBetween(0.8, 2.2);
      g.fillStyle(0x8fd3ff, a);
      g.fillCircle(p.x, p.y, r);
    }

    g.lineStyle(6, 0xffffff, 0.06);
    g.beginPath();
    g.arc(cx - 60, cy - 50, R + 5, Phaser.Math.DegToRad(210), Phaser.Math.DegToRad(330));
    g.strokePath();
  });

  // Vignette overlay
  tex("vignette", W, H, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, 0, W, 32);
    g.fillRect(0, H - 32, W, 32);
    g.fillRect(0, 0, 32, H);
    g.fillRect(W - 32, 0, 32, H);

    g.fillStyle(0x000000, 0.30);
    g.fillRect(0, 0, 120, 120);
    g.fillRect(W - 120, 0, 120, 120);
    g.fillRect(0, H - 120, 120, 120);
    g.fillRect(W - 120, H - 120, 120, 120);
  });

  // Player phage
  tex("phage", 64, 64, (g) => {
    g.lineStyle(3, 0x9fe3ff, 0.9);
    g.beginPath();
    g.moveTo(32, 40); g.lineTo(18, 58);
    g.moveTo(32, 40); g.lineTo(32, 60);
    g.moveTo(32, 40); g.lineTo(46, 58);
    g.strokePath();

    g.lineStyle(5, 0x7bd2ff, 1);
    g.beginPath();
    g.moveTo(32, 36); g.lineTo(32, 52);
    g.strokePath();

    g.fillStyle(0xb7f0ff, 1);
    g.fillCircle(32, 24, 14);

    g.lineStyle(3, 0x2b6a8f, 0.35);
    g.strokeCircle(32, 24, 12);
  });

  // Helper phage
  tex("helper", 48, 48, (g) => {
    g.lineStyle(3, 0x9fe3ff, 0.8);
    g.beginPath();
    g.moveTo(24, 30); g.lineTo(16, 44);
    g.moveTo(24, 30); g.lineTo(24, 46);
    g.moveTo(24, 30); g.lineTo(32, 44);
    g.strokePath();

    g.lineStyle(4, 0x7bd2ff, 0.95);
    g.beginPath();
    g.moveTo(24, 26); g.lineTo(24, 38);
    g.strokePath();

    g.fillStyle(0xb7f0ff, 1);
    g.fillCircle(24, 18, 10);
    g.lineStyle(2, 0x2b6a8f, 0.35);
    g.strokeCircle(24, 18, 9);
  });

  // Bacterium
  tex("bacterium", 64, 64, (g) => {
    g.fillStyle(0x62ff9e, 1);
    g.fillRoundedRect(16, 20, 32, 24, 12);

    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(20, 22, 12, 8, 6);

    g.lineStyle(3, 0x135c3b, 0.35);
    g.strokeRoundedRect(16, 20, 32, 24, 12);

    g.lineStyle(2, 0x62ff9e, 0.6);
    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(14, 50);
      const y = Phaser.Math.Between(18, 46);
      const dx = Phaser.Math.Between(-10, 10);
      const dy = Phaser.Math.Between(-10, 10);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + dx, y + dy);
      g.strokePath();
    }
  });

  // Injection ring
  tex("injectRing", 96, 96, (g) => {
    g.lineStyle(6, 0x9cc6ff, 0.55);
    g.strokeCircle(48, 48, 34);
    g.lineStyle(2, 0xffffff, 0.10);
    g.strokeCircle(48, 48, 38);
  });

  // Injection fill wedge
  tex("injectFill", 96, 96, (g) => {
    g.fillStyle(0x9cc6ff, 0.22);
    g.beginPath();
    g.moveTo(48, 48);
    g.arc(48, 48, 34, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(60), false);
    g.closePath();
    g.fillPath();
  });

  // Particle dot
  tex("particle", 10, 10, (g) => {
    g.fillStyle(0xc9ffea, 1);
    g.fillCircle(5, 5, 3);
  });

  // Shockwave
  tex("shock", 128, 128, (g) => {
    g.lineStyle(5, 0xc9ffea, 0.25);
    g.strokeCircle(64, 64, 44);
    g.lineStyle(2, 0xffffff, 0.14);
    g.strokeCircle(64, 64, 52);
  });

  // End panel
  tex("panel", 720, 220, (g) => {
    g.fillStyle(0x0b1b28, 1);
    g.fillRoundedRect(0, 0, 720, 220, 18);
    g.lineStyle(3, 0x9cc6ff, 0.35);
    g.strokeRoundedRect(0, 0, 720, 220, 18);
  });
}
