import test from "node:test";
import assert from "node:assert/strict";

import {
  FoundryV14NativeWebLevelProvider
} from "../scripts/foundry/webLevelProviderV14Native.js";

import {
  WEB_LEVEL_PROVIDER_MODES
} from "../scripts/simulation/webs/webLevelContract.js";

test(
  "Foundry v14 provider discovers native levels, wall ownership and viewed level",
  () => {
    const lower = {
      id:
        "lower",
      name:
        "Lower",
      documentName:
        "Level",
      elevation: {
        bottom:
          0,
        top:
          9
      }
    };

    const upper = {
      id:
        "upper",
      name:
        "Upper",
      documentName:
        "Level",
      elevation: {
        bottom:
          10,
        top:
          19
      }
    };

    const scene = {
      _view:
        "upper",
      levels: {
        contents: [
          lower,
          upper
        ]
      }
    };

    const provider =
      new FoundryV14NativeWebLevelProvider({
        game: {
          release: {
            generation:
              14
          }
        },
        canvas: {
          scene
        }
      });

    assert.equal(
      provider.isAvailable(
        scene
      ),
      true
    );

    const levels =
      provider.resolveLevels(
        scene
      );

    assert.deepEqual(
      levels.map(
        (
          level
        ) =>
          level.id
      ),
      [
        "lower",
        "upper"
      ]
    );

    const metadata =
      provider.resolveWallLevelMetadata(
        {
          id:
            "wall-upper",
          parent:
            upper
        },
        levels
      );

    assert.equal(
      metadata.levelProviderMode,
      WEB_LEVEL_PROVIDER_MODES.NATIVE_V14
    );

    assert.equal(
      metadata.levelId,
      "upper"
    );

    assert.deepEqual(
      metadata.elevationBand,
      {
        bottom:
          10,
        top:
          19
      }
    );

    assert.equal(
      provider.resolveActiveViewedLevel(
        scene,
        levels
      ),
      "upper"
    );
  }
);

test(
  "Foundry v14 native provider remains available for a single-level Scene",
  () => {
    const scene = {
      id:
        "single-level"
    };

    const provider =
      new FoundryV14NativeWebLevelProvider({
        game: {
          release: {
            generation:
              14
          }
        },
        canvas: {
          scene
        }
      });

    assert.equal(
      provider.isAvailable(
        scene
      ),
      true
    );

    const levels =
      provider.resolveLevels(
        scene
      );

    assert.equal(
      levels.length,
      1
    );

    assert.equal(
      levels[0].providerMode,
      WEB_LEVEL_PROVIDER_MODES.BASE
    );
  }
);
