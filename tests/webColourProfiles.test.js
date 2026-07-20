import test from "node:test";
import assert from "node:assert/strict";

import {
  createSceneConfigTemplateContext
} from "../scripts/ui/sceneConfigTemplateContext.js";

import {
  WebGenerationService
} from "../scripts/simulation/webs/WebGenerationService.js";

import {
  applyWebColourProfileToPopulation,
  getWebColourProfile,
  getWebColourProfiles
} from "../scripts/simulation/webs/webColourProfiles.js";

const CONTEXT =
  Object.freeze({
    sceneId:
      "colour-scene",
    sceneRect:
      Object.freeze({
        x:
          0,
        y:
          0,
        width:
          1000,
        height:
          1000,
        right:
          1000,
        bottom:
          1000
      }),
    gridSize:
      100,
    wallSegments:
      Object.freeze([])
  });

function createOptions(
  colourProfileId
) {
  return {
    colourProfileId,
    cornerWebs: {
      enabled:
        false
    },
    spanWebs: {
      enabled:
        false
    },
    groundWebs: {
      enabled:
        true,
      count:
        2
    }
  };
}

function projectGeometry(
  webs
) {
  return webs.map(
    (
      web
    ) => ({
      id:
        web.id,
      kind:
        web.kind,
      hub:
        web.hub,
      bounds:
        web.bounds,
      perches:
        web.perches,
      supportingWallIds:
        web.supportingWallIds,
      strands:
        web.strands.map(
          (
            strand
          ) => ({
            id:
              strand.id,
            localId:
              strand.localId,
            kind:
              strand.kind,
            points:
              strand.points,
            baseAlpha:
              strand.baseAlpha,
            widthPx:
              strand.widthPx,
            collisionWidthPx:
              strand.collisionWidthPx
          })
        )
    })
  );
}

test(
  "authored colour profiles are frozen and role-specific",
  () => {
    const profiles =
      getWebColourProfiles();

    assert.equal(
      profiles.length,
      7
    );

    assert.equal(
      Object.isFrozen(
        profiles
      ),
      true
    );

    const profile =
      getWebColourProfile(
        "arcane-blue"
      );

    assert.equal(
      profile.configuration.structuralColour,
      0x4ea5d9
    );

    assert.equal(
      profile.configuration.captureColour,
      0x79c8f2
    );

    assert.equal(
      profile.configuration.decorativeColour,
      0x2876a8
    );

    assert.equal(
      Object.isFrozen(
        profile.configuration
      ),
      true
    );
  }
);

test(
  "colour choice changes presentation but not deterministic geometry or identifiers",
  () => {
    const service =
      new WebGenerationService();

    const natural =
      service.generate(
        CONTEXT,
        createOptions(
          "natural-white"
        )
      );

    const red =
      service.generate(
        CONTEXT,
        createOptions(
          "blood-red"
        )
      );

    assert.deepEqual(
      projectGeometry(
        natural.webs
      ),
      projectGeometry(
        red.webs
      )
    );

    assert.equal(
      natural.seed,
      red.seed
    );

    assert.deepEqual(
      natural.categorySeeds,
      red.categorySeeds
    );

    assert.equal(
      natural.webs[0].id,
      red.webs[0].id
    );

    assert.notEqual(
      natural.webs[0].strands[0].colour,
      red.webs[0].strands[0].colour
    );

    assert.equal(
      natural.webs[0].strands[0].baseAlpha,
      red.webs[0].strands[0].baseAlpha
    );
  }
);

test(
  "visual remapping reuses immutable geometry references",
  () => {
    const service =
      new WebGenerationService();

    const generated =
      service.generate(
        CONTEXT,
        createOptions(
          "natural-white"
        )
      );

    const originalWeb =
      generated.webs[0];

    const originalStrand =
      originalWeb.strands[0];

    const recoloured =
      applyWebColourProfileToPopulation(
        generated.webs,
        "toxic-green"
      );

    assert.equal(
      recoloured[0].id,
      originalWeb.id
    );

    assert.equal(
      recoloured[0].hub,
      originalWeb.hub
    );

    assert.equal(
      recoloured[0].bounds,
      originalWeb.bounds
    );

    assert.equal(
      recoloured[0].perches,
      originalWeb.perches
    );

    assert.equal(
      recoloured[0].supportingWallIds,
      originalWeb.supportingWallIds
    );

    assert.equal(
      recoloured[0].strands[0].points,
      originalStrand.points
    );

    assert.equal(
      recoloured[0].strands[0].widthPx,
      originalStrand.widthPx
    );

    assert.equal(
      recoloured[0].strands[0].collisionWidthPx,
      originalStrand.collisionWidthPx
    );

    assert.equal(
      recoloured[0].strands[0].colour,
      0x74b83e
    );
  }
);

test(
  "Scene Configuration context exposes density and colour selectors",
  async () => {
    const scene = {
      getFlag(
        _namespace,
        key
      ) {
        if (
          key ===
            "webColour"
        ) {
          return "yellowed";
        }

        if (
          key ===
            "webThickness"
        ) {
          return 1.75;
        }

        return "dense";
      }
    };

    const context =
      await createSceneConfigTemplateContext({
        application: {
          isEditable:
            true
        },
        scene
      });

    assert.equal(
      context.configuration.webDensity,
      "dense"
    );

    assert.equal(
      context.configuration.webColour,
      "yellowed"
    );

    assert.equal(
      context.fieldNames.webColour,
      "flags.dynamic-webs.webColour"
    );

    assert.equal(
      context.configuration.webThickness,
      1.75
    );

    assert.equal(
      context.webColourControl.options.find(
        (
          option
        ) =>
          option.value ===
            "yellowed"
      ).selected,
      true
    );
  }
);
