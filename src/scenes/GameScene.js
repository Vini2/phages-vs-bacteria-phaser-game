/**
 * @file src/scenes/GameScene.js
 * @author Vijini Mallawaarachchi <viji.mallawaarachchi@gmail.com>
 * @version 0.0.1
 * @description
 * Main gameplay scene for Phagefall (phages vs bacteria).
 *
 * Core loop:
 * - Player moves via WASD/arrow keys
 * - Click/tap bacteria in range to attach and inject
 * - Injection completes -> bacterium lyses -> score increases -> helpers spawn
 * - Bacteria reproduce over time with ramping difficulty
 * - Win by reaching neededToWin score, lose if bacteria exceed loseThreshold
 *
 * Responsibilities:
 * - Build the dish, player, groups, UI, particles
 * - Handle input + movement + injection logic
 * - Spawn bacteria + helpers + manage difficulty ramp
 * - Run tutorial overlay sequence
 * - Display end screen with New Game button
 *
 * External dependencies:
 * - systems/behaviors.js for bacteria + helper movement/AI
 * - systems/geometry.js for dish point math
 * - config.js for dimensions and balance constants
 */


import { W, H, GAME_SETTINGS } from "../config.js";
import { bacteriaDrift, helperBrain } from "../systems/behaviors.js";
import { randomPointInDish, clampToDishPoint } from "../systems/geometry.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    this.center = new Phaser.Math.Vector2(W / 2, H / 2);
    this.dishRadius = Math.min(W, H) * 0.44;

    // State
    this.score = 0;
    this.neededToWin = GAME_SETTINGS.neededToWin;
    this.loseThreshold = GAME_SETTINGS.loseThreshold;
    this.gameOver = false;

    // Helpers / difficulty
    this.maxHelpers = GAME_SETTINGS.maxHelpers;
    this.killerHelperChance = GAME_SETTINGS.killerHelperChance;
    this.killerLysisChancePerSec = GAME_SETTINGS.killerLysisChancePerSec;

    // Music
    this.music = null;
    this.musicTargetVolume = GAME_SETTINGS.musicTargetVolume;

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
    this.vignette = this.add.image(this.center.x, this.center.y, "vignette")
      .setDepth(1000)
      .setAlpha(0.6);

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

    this.hintText = this.add.text(
      16,
      36,
      "Tap/click a bacterium to attach → inject → lyse → replicate",
      {
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        fontSize: "14px",
        color: "#9cc6ff"
      }
    ).setAlpha(0.9);

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

    // --- MUSIC START (browser-safe) ---
    this.music = this.sound.add("bgm", { loop: true, volume: 0 });
    this.sound.once("unlocked", () => {
      if (!this.music || this.gameOver) return;
      this.music.play({ volume: 0 });

      this.tweens.add({
        targets: this.music,
        volume: this.musicTargetVolume,
        duration: 2000,
        ease: "Sine.easeOut"
      });
    });
    // --- MUSIC END ---

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
        const popRamp = Phaser.Math.Clamp(n / 22, 0, 2.0);

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
    this.baseInjectDuration = GAME_SETTINGS.baseInjectDuration;
    this.injectDuration = this.baseInjectDuration;
    this.attachRange = GAME_SETTINGS.attachRange;

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
  }

  update(t, dtMs) {
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

      this.injectRing
        .setVisible(true)
        .setPosition(this.attachedTarget.x, this.attachedTarget.y)
        .setAlpha(0.85);

      this.injectFill
        .setVisible(true)
        .setPosition(this.attachedTarget.x, this.attachedTarget.y)
        .setAlpha(0.95);

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
  }

  handleMovement(dt) {
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
  }

  tryAttachAt(x, y) {
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
  }

  startInjecting(bacterium) {
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
  }

  stopInjecting() {
    this.injecting = false;
    if (this.attachedTarget) this.attachedTarget.setData("infected", false);
    this.attachedTarget = null;
    this.injectRing.setVisible(false);
    this.injectFill.setVisible(false);
    this.injectFill.setScale(1);
  }

  lysis(b) {
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
  }

  spawnBacterium() {
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
  }

  spawnBacteriumNearExisting() {
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
    this.tweens.add({
      targets: b,
      scale: Phaser.Math.FloatBetween(0.85, 1.15),
      duration: 180,
      ease: "Back.easeOut"
    });

    return b;
  }

  spawnHelperPhageNear(x, y) {
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

    const isKiller = Math.random() < this.killerHelperChance;
    h.setData("killer", isKiller);
    h.setData("cooldown", 0);

    if (isKiller) h.setTint(0xffc45a);

    return h;
  }

  constrainToDish(sprite) {
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
  }

  endGame(won) {
    this.gameOver = true;
    this.stopInjecting();

    // Fade out music on game end
    if (this.music && this.music.isPlaying) {
      this.tweens.add({
        targets: this.music,
        volume: 0,
        duration: 900,
        ease: "Sine.easeInOut",
        onComplete: () => {
          if (this.music) this.music.stop();
        }
      });
    }

    // --- End UI container ---
    this.endUI = this.add.container(0, 0).setDepth(3000);

    const banner = this.add.image(this.center.x, this.center.y, "panel").setAlpha(0.92);
    this.endUI.add(banner);

    const title = won ? "YOU WIN" : "YOU LOSE";
    const subtitle = won
      ? "You cleared enough bacteria before they overran the dish."
      : "Bacteria overran the dish. Try attaching faster!";

    const titleText = this.add.text(this.center.x, this.center.y - 26, title, {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      fontSize: "40px",
      color: "#e8f3ff"
    }).setOrigin(0.5);

    const subtitleText = this.add.text(this.center.x, this.center.y + 14, subtitle, {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      fontSize: "16px",
      color: "#b8d7ff",
      align: "center",
      wordWrap: { width: 640 }
    }).setOrigin(0.5);

    this.endUI.add([titleText, subtitleText]);

    // --- NEW GAME BUTTON ---
    const btnW = 220;
    const btnH = 46;
    const btnX = this.center.x;
    const btnY = this.center.y + 74;

    const btnBg = this.add
      .rectangle(btnX, btnY, btnW, btnH, 0x0e2a3d, 0.95)
      .setStrokeStyle(2, 0x9cc6ff, 0.55)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add.text(btnX, btnY, "New Game", {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      fontSize: "16px",
      color: "#e8f3ff"
    }).setOrigin(0.5);

    btnBg.on("pointerover", () => {
      btnBg.setFillStyle(0x123a54, 1);
      btnBg.setStrokeStyle(2, 0x9cc6ff, 0.85);
    });
    btnBg.on("pointerout", () => {
      btnBg.setFillStyle(0x0e2a3d, 0.95);
      btnBg.setStrokeStyle(2, 0x9cc6ff, 0.55);
    });

    btnBg.on("pointerdown", () => {
      if (this.endUI) this.endUI.destroy(true);
      this.scene.restart();
    });

    this.endUI.add([btnBg, btnText]);

    // Pop-in
    this.endUI.setScale(0.1);
    this.tweens.add({ targets: this.endUI, scale: 1, duration: 260, ease: "Back.easeOut" });
  }

  // ---------------------------- Tutorial ----------------------------

  startTutorial() {
    this.tutorialActive = true;
    this.tutorialStep = 0;

    this.tutorialOverlay = this.add
      .rectangle(W / 2, H / 2, W, H, 0x000000, 0.55)
      .setDepth(2000)
      .setInteractive();

    this.tutorialPanel = this.add
      .image(W / 2, H / 2 + 120, "panel")
      .setDepth(2001)
      .setAlpha(0.96);

    const baseStyle = {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      color: "#e8f3ff",
      align: "center",
      wordWrap: { width: 640 }
    };

    this.tutorialTitle = this.add
      .text(W / 2, H / 2 + 60, "", { ...baseStyle, fontSize: "28px" })
      .setOrigin(0.5)
      .setDepth(2002);

    this.tutorialBody = this.add
      .text(W / 2, H / 2 + 110, "", { ...baseStyle, fontSize: "16px", color: "#b8d7ff" })
      .setOrigin(0.5)
      .setDepth(2002);

    this.tutorialHint = this.add
      .text(W / 2, H / 2 + 165, "Tap/click to continue  •  Space also works", {
        ...baseStyle,
        fontSize: "14px",
        color: "#9cc6ff"
      })
      .setOrigin(0.5)
      .setDepth(2002)
      .setAlpha(0.9);

    this.tutorialPointer = this.add
      .image(this.center.x, this.center.y, "shock")
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
  }

  renderTutorialStep() {
    const step = this.tutorialStep;
    const pointAt = (x, y) => this.tutorialPointer.setPosition(x, y);

    const firstBacterium = this.bacteria.getChildren().find((b) => b && b.active);

    if (step === 0) {
      this.tutorialTitle.setText("Phagefall");
      this.tutorialBody.setText(
        "You are a phage in a petri dish.\nClear enough bacteria before they multiply out of control."
      );
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
      this.tutorialBody.setText(
        "When injection finishes, the bacterium bursts (lysis).\nYou gain points and spawn extra phages."
      );
      pointAt(this.center.x - 120, this.center.y);
    } else if (step === 5) {
      this.tutorialTitle.setText("Win / Lose");
      this.tutorialBody.setText(`Win: reach ${this.neededToWin} lysis points.\nLose: if bacteria overrun the dish.`);
      pointAt(this.center.x, this.center.y);
    } else {
      this.endTutorial();
    }
  }

  endTutorial() {
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
  }
}
