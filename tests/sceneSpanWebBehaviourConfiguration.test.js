import test from "node:test";
import assert from "node:assert/strict";

import {
  createSceneSpanWebBehaviourFlagValue,
  getSceneSpanWebBehaviourConfiguration,
  normaliseSceneSpanWebBehaviour
} from "../scripts/config/sceneSpanWebBehaviourConfiguration.js";

function createScene(
  value
) {
  return {
    id:
      "scene-a",
    getFlag(
      _namespace,
      key
    ) {
      return key ===
        "spanWebBehaviour"
        ? value
        : undefined;
    }
  };
}

const worldBehaviour =
  Object.freeze({
    visionMode:
      "limited",
    secretDoor:
      false,
    destructible:
      true
  });

test(
  "missing Scene span behaviour follows world defaults",
  () => {
    const result =
      getSceneSpanWebBehaviourConfiguration(
        createScene(
          undefined
        ),
        {
          worldMaximumSpanGridUnits:
            2.5,
          worldBehaviour
        }
      );

    assert.equal(
      result.maximumSpanGridUnits,
      2.5
    );
    assert.equal(
      result.maximumSpanGridUnitsOverride,
      null
    );
    assert.equal(
      result.maximumSpanWidthSource,
      "world-default"
    );
    assert.equal(
      result.visionMode,
      "limited"
    );
    assert.equal(
      result.secretDoor,
      false
    );
    assert.equal(
      result.destructible,
      true
    );
  }
);

test(
  "Scene span behaviour overrides width, vision, secret door and destructibility",
  () => {
    const result =
      getSceneSpanWebBehaviourConfiguration(
        createScene({
          schemaVersion:
            1,
          maximumSpanGridUnits:
            3.25,
          visionMode:
            "blocked",
          secretDoor:
            true,
          destructible:
            false
        }),
        {
          worldMaximumSpanGridUnits:
            1.5,
          worldBehaviour
        }
      );

    assert.equal(
      result.maximumSpanGridUnits,
      3.25
    );
    assert.equal(
      result.maximumSpanWidthSource,
      "scene-override"
    );
    assert.equal(
      result.visionMode,
      "blocked"
    );
    assert.equal(
      result.secretDoor,
      true
    );
    assert.equal(
      result.destructible,
      false
    );
  }
);

test(
  "Scene span behaviour accepts the Scene form JSON representation",
  () => {
    const value =
      createSceneSpanWebBehaviourFlagValue({
        maximumSpanGridUnits:
          null,
        visionMode:
          "none",
        secretDoor:
          false,
        destructible:
          false
      }, {
        worldMaximumSpanGridUnits:
          2,
        worldBehaviour
      });

    const reparsed =
      normaliseSceneSpanWebBehaviour(
        JSON.stringify(
          value
        ),
        {
          worldMaximumSpanGridUnits:
            2,
          worldBehaviour
        }
      );

    assert.deepEqual(
      value,
      {
        schemaVersion:
          1,
        maximumSpanGridUnits:
          null,
        visionMode:
          "none",
        secretDoor:
          false,
        destructible:
          false
      }
    );
    assert.equal(
      reparsed.maximumSpanGridUnits,
      2
    );
  }
);
