import { W, H } from "./config.js";
import { BootScene } from "./scenes/BootScene.js";
import { GameScene } from "./scenes/GameScene.js";

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
