import test from "node:test";
import assert from "node:assert/strict";

import {
  BASE_WEB_LEVEL_ID,
  WEB_LEVEL_PROVIDER_MODES,
  createBaseWebLevel,
  createElevationBandLevelId,
  createWebElevationBand,
  createWebLevelDescriptor,
  elevationBandsEqual,
  elevationBandsOverlap,
  normaliseWebLevelProviderMode
} from "../scripts/simulation/webs/webLevelContract.js";

test(
  "level descriptors are stable, normalised and deeply frozen",
  () => {
    const level =
      createWebLevelDescriptor({
        id:
          "floor-1",
        label:
          "First floor",
        providerMode:
          WEB_LEVEL_PROVIDER_MODES.NATIVE_V14,
        elevationBand: {
          bottom:
            10,
          top:
            19.9
        }
      });

    assert.deepEqual(
      level,
      {
        id:
          "floor-1",
        label:
          "First floor",
        providerMode:
          WEB_LEVEL_PROVIDER_MODES.NATIVE_V14,
        elevationBand: {
          bottom:
            10,
          top:
            19.9
        },
        source:
          null
      }
    );

    assert.equal(
      Object.isFrozen(
        level
      ),
      true
    );

    assert.equal(
      Object.isFrozen(
        level.elevationBand
      ),
      true
    );

    assert.equal(
      createElevationBandLevelId(
        10,
        19.5
      ),
      "elevation:10:19_5"
    );
  }
);

test(
  "base level and elevation-band comparisons are absence-safe",
  () => {
    const base =
      createBaseWebLevel();

    assert.equal(
      base.id,
      BASE_WEB_LEVEL_ID
    );

    assert.deepEqual(
      createWebElevationBand(),
      {
        bottom:
          null,
        top:
          null
      }
    );

    assert.equal(
      elevationBandsEqual(
        {
          bottom:
            0,
          top:
            9
        },
        {
          bottom:
            0,
          top:
            9
        }
      ),
      true
    );

    assert.equal(
      elevationBandsOverlap(
        {
          bottom:
            0,
          top:
            10
        },
        {
          bottom:
            10,
          top:
            20
        }
      ),
      true
    );

    assert.equal(
      normaliseWebLevelProviderMode(
        ""
      ),
      WEB_LEVEL_PROVIDER_MODES.AUTO
    );

    assert.throws(
      () =>
        createWebElevationBand({
          bottom:
            20,
          top:
            10
        }),
      /cannot end below/u
    );
  }
);
