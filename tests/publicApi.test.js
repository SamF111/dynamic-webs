import test from "node:test";
import assert from "node:assert/strict";

import {
  createPublicApi
} from "../scripts/api.js";

function createEnvironment() {
  const previousGame =
    globalThis.game;

  const previousCanvas =
    globalThis.canvas;

  const calls = {
    generate:
      [],
    clear:
      [],
    setFlag:
      []
  };

  const webSnapshot =
    Object.freeze({
      active:
        true,
      sceneId:
        "scene"
    });

  const service = {
    generateForActiveScene(
      options
    ) {
      calls.generate.push(
        options
      );

      return webSnapshot;
    },

    clear(
      reason
    ) {
      calls.clear.push(
        reason
      );

      return true;
    },

    createDiagnosticSnapshot() {
      return webSnapshot;
    }
  };

  const runtime = {
    runtimeOwnerType:
      "DynamicWebsRuntime",
    ready:
      true,
    getWebRuntimeService:
      () =>
        service
  };

  const scene = {
    id:
      "scene",
    getFlag(
      namespace,
      key
    ) {
      assert.equal(
        namespace,
        "dynamic-webs"
      );

      if (
        key ===
          "webDensity"
      ) {
        return "dense";
      }

      if (
        key ===
          "webColour"
      ) {
        return "arcane-blue";
      }

      if (
        key ===
          "webThickness"
      ) {
        return 1.5;
      }

      return undefined;
    },

    async setFlag(
      namespace,
      key,
      value
    ) {
      calls.setFlag.push({
        namespace,
        key,
        value
      });

      return this;
    }
  };

  globalThis.canvas = {
    scene
  };

  globalThis.game = {
    user: {
      isGM:
        true
    },
    modules: {
      get:
        () => ({
          version:
            "0.2.1"
        })
    },
    scenes: {
      get:
        (
          id
        ) =>
          id ===
            "scene"
            ? scene
            : null
    }
  };

  return {
    runtime,
    calls,
    scene,
    restore() {
      globalThis.game =
        previousGame;

      globalThis.canvas =
        previousCanvas;
    }
  };
}

test(
  "public API and namespaces are frozen",
  () => {
    const environment =
      createEnvironment();

    try {
      const api =
        createPublicApi(
          environment.runtime
        );

      assert.equal(
        api.version,
        1
      );

      assert.equal(
        Object.isFrozen(
          api
        ),
        true
      );

      assert.equal(
        Object.isFrozen(
          api.webs
        ),
        true
      );

      assert.equal(
        Object.isFrozen(
          api.scene
        ),
        true
      );

      assert.equal(
        Object.isFrozen(
          api.diagnostics
        ),
        true
      );

      assert.equal(
        Object.isFrozen(
          api.colours
        ),
        true
      );

      assert.equal(
        api.getState().webs,
        environment.runtime
          .getWebRuntimeService()
          .createDiagnosticSnapshot()
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "public web operations delegate through the runtime service",
  () => {
    const environment =
      createEnvironment();

    try {
      const api =
        createPublicApi(
          environment.runtime
        );

      const generated =
        api.webs.generate({
          groundWebs: {
            count:
              2
          }
        });

      assert.equal(
        generated.active,
        true
      );

      assert.equal(
        environment.calls.generate.length,
        1
      );

      assert.equal(
        environment.calls.generate[0].reason,
        "public-api-generate"
      );

      assert.deepEqual(
        environment.calls.generate[0].options,
        {
          groundWebs: {
            count:
              2
          }
        }
      );

      assert.equal(
        environment.calls.generate[0].colourProfileId,
        "arcane-blue"
      );

      const cleared =
        api.webs.clear();

      assert.equal(
        cleared.cleared,
        true
      );

      assert.deepEqual(
        environment.calls.clear,
        [
          "public-api-clear"
        ]
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "public Scene operations read and persist only supported densities",
  async () => {
    const environment =
      createEnvironment();

    try {
      const api =
        createPublicApi(
          environment.runtime
        );

      assert.equal(
        api.scene.getDensity(),
        "dense"
      );

      await api.scene.setDensity(
        "sparse"
      );

      assert.deepEqual(
        environment.calls.setFlag,
        [
          {
            namespace:
              "dynamic-webs",
            key:
              "webDensity",
            value:
              "sparse"
          }
        ]
      );

      await assert.rejects(
        () =>
          api.scene.setDensity(
            "impossible"
          ),
        /Unsupported Scene web density/u
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "public colour operations expose frozen profiles and persist supported Scene colours",
  async () => {
    const environment =
      createEnvironment();

    try {
      const api =
        createPublicApi(
          environment.runtime
        );

      assert.equal(
        api.scene.getColour(),
        "arcane-blue"
      );

      const profiles =
        api.colours.getProfiles();

      assert.equal(
        Object.isFrozen(
          profiles
        ),
        true
      );

      assert.equal(
        api.colours.getProfile(
          "blood-red"
        ).label,
        "Blood Red"
      );

      await api.scene.setColour(
        "toxic-green"
      );

      assert.deepEqual(
        environment.calls.setFlag.at(-1),
        {
          namespace:
            "dynamic-webs",
          key:
            "webColour",
          value:
            "toxic-green"
        }
      );

      await assert.rejects(
        () =>
          api.scene.setColour(
            "impossible"
          ),
        /Unsupported Scene web colour/u
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "public thickness operations read and persist supported multipliers",
  async () => {
    const environment =
      createEnvironment();

    try {
      const api =
        createPublicApi(
          environment.runtime
        );

      assert.equal(
        api.scene.getThickness(),
        1.5
      );

      await api.scene.setThickness(
        2.25
      );

      assert.deepEqual(
        environment.calls.setFlag.at(-1),
        {
          namespace:
            "dynamic-webs",
          key:
            "webThickness",
          value:
            2.25
        }
      );

      await assert.rejects(
        () =>
          api.scene.setThickness(
            6
          ),
        /between 0.5 and 4/u
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "GM-only operations reject non-GM callers",
  async () => {
    const environment =
      createEnvironment();

    try {
      globalThis.game.user.isGM =
        false;

      const api =
        createPublicApi(
          environment.runtime
        );

      assert.throws(
        () =>
          api.webs.generate(),
        /only be performed by a GM/u
      );

      assert.throws(
        () =>
          api.webs.clear(),
        /only be performed by a GM/u
      );

      await assert.rejects(
        () =>
          api.scene.setDensity(
            "dense"
          ),
        /only be performed by a GM/u
      );

      await assert.rejects(
        () =>
          api.scene.setThickness(
            2
          ),
        /only be performed by a GM/u
      );
    } finally {
      environment.restore();
    }
  }
);
