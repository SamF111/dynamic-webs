import {
  BASE_WEB_LEVEL_ID,
  WEB_LEVEL_PROVIDER_MODES,
  createBaseWebLevel
} from "../simulation/webs/webLevelContract.js";

export class BaseWebLevelProvider {
  constructor() {
    this.mode =
      WEB_LEVEL_PROVIDER_MODES.BASE;
  }

  isAvailable() {
    return true;
  }

  resolveLevels() {
    return Object.freeze([
      createBaseWebLevel()
    ]);
  }

  resolveWallLevelMetadata() {
    return Object.freeze({
      levelProviderMode:
        this.mode,
      levelId:
        BASE_WEB_LEVEL_ID,
      elevationBand:
        createBaseWebLevel().elevationBand,
      resolved:
        true,
      source:
        "base"
    });
  }

  resolveActiveViewedLevel() {
    return BASE_WEB_LEVEL_ID;
  }
}
