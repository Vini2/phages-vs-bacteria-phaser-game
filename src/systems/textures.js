/**
 * @file src/systems/textures.js
 * @author Vijini Mallawaarachchi <viji.mallawaarachchi@gmail.com>
 * @version 0.0.1
 * @description
 * Procedural texture generator for Phaser.
 * Creates all sprite + UI textures at runtime using Phaser Graphics
 * so no image files are needed for visuals.
 *
 * Responsibilities:
 * - Generate textures: dish, vignette, phage, helper, bacterium, injectRing,
 *   injectFill, particle, shock, panel
 *
 * Notes:
 * - Relies on W/H for canvas sizing
 * - Uses geometry.randomPointInDish for starfield speckles in dish
 */


import { W, H } from "../config.js";
import { randomPointInDish } from "./geometry.js";

export function makeTextures(scene) {
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

  tex("injectRing", 96, 96, (g) => {
    g.lineStyle(6, 0x9cc6ff, 0.55);
    g.strokeCircle(48, 48, 34);
    g.lineStyle(2, 0xffffff, 0.10);
    g.strokeCircle(48, 48, 38);
  });

  tex("injectFill", 96, 96, (g) => {
    g.fillStyle(0x9cc6ff, 0.22);
    g.beginPath();
    g.moveTo(48, 48);
    g.arc(48, 48, 34, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(60), false);
    g.closePath();
    g.fillPath();
  });

  tex("particle", 10, 10, (g) => {
    g.fillStyle(0xc9ffea, 1);
    g.fillCircle(5, 5, 3);
  });

  tex("shock", 128, 128, (g) => {
    g.lineStyle(5, 0xc9ffea, 0.25);
    g.strokeCircle(64, 64, 44);
    g.lineStyle(2, 0xffffff, 0.14);
    g.strokeCircle(64, 64, 52);
  });

  tex("panel", 720, 220, (g) => {
    g.fillStyle(0x0b1b28, 1);
    g.fillRoundedRect(0, 0, 720, 220, 18);
    g.lineStyle(3, 0x9cc6ff, 0.35);
    g.strokeRoundedRect(0, 0, 720, 220, 18);
  });
}
