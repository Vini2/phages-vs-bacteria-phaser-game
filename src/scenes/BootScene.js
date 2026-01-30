/**
 * @file src/scenes/BootScene.js
 * @author Vijini Mallawaarachchi <viji.mallawaarachchi@gmail.com>
 * @version 0.0.1
 * @description
 * Boot scene responsible for preloading minimal assets (audio) and generating
 * procedural textures used by the game (no external sprite images required).
 *
 * Responsibilities:
 * - Preload background music audio
 * - Generate procedural textures (dish, phage, bacterium, UI art)
 * - Transition to GameScene
 *
 * Asset requirements:
 * - assets/bg_music.mp3 must exist relative to project root
 */


import { makeTextures } from "../systems/textures.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.audio("bgm", "assets/bg_music.mp3");
  }

  create() {
    makeTextures(this);
    this.scene.start("GameScene");
  }
}
