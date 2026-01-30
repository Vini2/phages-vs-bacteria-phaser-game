/**
 * @file src/config.js
* @author Vijini Mallawaarachchi <viji.mallawaarachchi@gmail.com>
 * @version 0.0.1
 * @description
 * Centralized configuration for game dimensions and tunable gameplay constants.
 *
 * Responsibilities:
 * - Provide shared width/height used by textures and scenes
 * - Provide GAME_SETTINGS for balancing difficulty and feel
 *
 * Editing guide:
 * - baseInjectDuration: base injection time in ms
 * - killerHelperChance / killerLysisChancePerSec: helper aggressiveness
 * - neededToWin / loseThreshold: win/lose pacing
 */


export const W = 960;
export const H = 540;

export const GAME_SETTINGS = {
  neededToWin: 35,
  loseThreshold: 55,

  maxHelpers: 6,

  killerHelperChance: 0.90,
  killerLysisChancePerSec: 0.35,

  baseInjectDuration: 750,
  attachRange: 92,

  musicTargetVolume: 0.35,
};
