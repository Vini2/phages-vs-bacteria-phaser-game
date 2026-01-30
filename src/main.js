/**
 * @file src/main.js
 * @author Vijini Mallawaarachchi <viji.mallawaarachchi@gmail.com>
 * @version 0.0.1
 * @description
 * Entry point for the Phagefall Phaser 3 game.
 * Creates the Phaser.Game instance using the shared config and scene classes.
 *
 * Responsibilities:
 * - Import scenes and constants
 * - Build Phaser game configuration
 * - Instantiate the Phaser game
 *
 * Notes:
 * - Requires Phaser to be loaded globally (e.g. via CDN in index.html)
 * - Uses ES modules (`type="module"`)
 */


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
