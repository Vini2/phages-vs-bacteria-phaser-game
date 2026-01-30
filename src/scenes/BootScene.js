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
