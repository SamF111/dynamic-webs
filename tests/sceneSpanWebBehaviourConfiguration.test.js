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
    crossingAction:
      "destroy-web"
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
      result.crossingAction,
      "destroy-web"
    );
  }
);

test(
  "Scene span behaviour overrides width, vision, movement blocking and crossing action",
  () => {
    const result =
      getSceneSpanWebBehaviourConfiguration(
        createScene({
          schemaVersion:
            2,
          maximumSpanGridUnits:
            3.25,
          visionMode:
            "blocked",
          secretDoor:
            true,
          crossingAction:
            "open-secret-door"
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
      result.crossingAction,
      "open-secret-door"
    );
  }
);

test(
  "schema v1 destructibility migrates without changing existing Scene semantics",
  () => {
    const destructive =
      normaliseSceneSpanWebBehaviour(
        {
          schemaVersion:
            1,
          maximumSpanGridUnits:
            null,
          visionMode:
            "limited",
          secretDoor:
            true,
          destructible:
            true
        },
        {
          worldMaximumSpanGridUnits:
            2,
          worldBehaviour
        }
      );

    const indestructible =
      normaliseSceneSpanWebBehaviour(
        {
          schemaVersion:
            1,
          maximumSpanGridUnits:
            null,
          visionMode:
            "limited",
          secretDoor:
            true,
          destructible:
            false
        },
        {
          worldMaximumSpanGridUnits:
            2,
          worldBehaviour
        }
      );

    assert.equal(
      destructive.schemaVersion,
      2
    );
    assert.equal(
      destructive.crossingAction,
      "destroy-web"
    );
    assert.equal(
      indestructible.crossingAction,
      "none"
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
          true,
        crossingAction:
          "open-secret-door"
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
          2,
        maximumSpanGridUnits:
          null,
        visionMode:
          "none",
        secretDoor:
          true,
        crossingAction:
          "open-secret-door"
      }
    );
    assert.equal(
      reparsed.maximumSpanGridUnits,
      2
    );
  }
);

test(
  "Open Secret Door normalises to No Action when movement blocking is disabled",
  () => {
    const result =
      normaliseSceneSpanWebBehaviour(
        {
          schemaVersion:
            2,
          visionMode:
            "limited",
          secretDoor:
            false,
          crossingAction:
            "open-secret-door"
        },
        {
          worldMaximumSpanGridUnits:
            2,
          worldBehaviour
        }
      );

    assert.equal(
      result.crossingAction,
      "none"
    );
  }
);
