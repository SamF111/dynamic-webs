import webColourProfilesData from "../../../data/webs/colours.json" with {
  type:
    "json"
};

import {
  validateWebColourProfiles
} from "../../data/webDataContracts.js";

import {
  assertWebPopulationIntegrity,
  deepFreezeWebValue
} from "./webBlueprintContract.js";

const VALIDATED_WEB_COLOUR_DATA =
  validateWebColourProfiles(
    webColourProfilesData
  );

export const DEFAULT_WEB_COLOUR_PROFILE_ID =
  VALIDATED_WEB_COLOUR_DATA.defaultProfileId;

export const WEB_COLOUR_PROFILES =
  VALIDATED_WEB_COLOUR_DATA.profiles;

const WEB_COLOUR_PROFILES_BY_ID =
  new Map(
    WEB_COLOUR_PROFILES.map(
      (
        profile
      ) => [
        profile.id,
        profile
      ]
    )
  );

export const WEB_COLOUR_PROFILE_ORDER =
  Object.freeze(
    WEB_COLOUR_PROFILES.map(
      (
        profile
      ) =>
        profile.id
    )
  );

export const WEB_COLOUR_OPTIONS =
  Object.freeze(
    WEB_COLOUR_PROFILES.map(
      (
        profile
      ) => Object.freeze({
        id:
          profile.id,
        label:
          profile.label
      })
    )
  );

/** Return whether one identifier names an authored colour profile. */
export function isSupportedWebColourProfileId(
  value
) {
  return (
    typeof value ===
      "string" &&
    WEB_COLOUR_PROFILES_BY_ID.has(
      value.trim()
    )
  );
}

/** Resolve one immutable authored colour profile. */
export function getWebColourProfile(
  profileId = DEFAULT_WEB_COLOUR_PROFILE_ID
) {
  if (
    typeof profileId !==
      "string"
  ) {
    throw new TypeError(
      "Dynamic Webs | Web colour profile must be a string."
    );
  }

  const id =
    profileId.trim();

  const profile =
    WEB_COLOUR_PROFILES_BY_ID.get(
      id
    );

  if (!profile) {
    throw new Error(
      `Dynamic Webs | Unsupported web colour profile "${id}". Supported profiles: ${WEB_COLOUR_PROFILE_ORDER.join(", ")}.`
    );
  }

  return profile;
}

/** Return all immutable authored colour profiles. */
export function getWebColourProfiles() {
  return WEB_COLOUR_PROFILES;
}

/** Return immutable selector options for Scene Configuration. */
export function getWebColourOptions() {
  return WEB_COLOUR_OPTIONS;
}

/**
 * Re-resolve strand presentation from an existing immutable web population.
 * Geometry objects, identifiers, points, bounds, perches and support IDs are
 * retained. Only immutable strand presentation objects are replaced.
 */
export function applyWebColourProfileToPopulation(
  webs,
  profileOrId = DEFAULT_WEB_COLOUR_PROFILE_ID
) {
  const profile =
    typeof profileOrId ===
      "string"
      ? getWebColourProfile(
          profileOrId
        )
      : getWebColourProfile(
          profileOrId?.id
        );

  const configuration =
    profile.configuration;

  const coloursByKind =
    Object.freeze({
      structural:
        configuration.structuralColour,
      capture:
        configuration.captureColour,
      decorative:
        configuration.decorativeColour
    });

  const population =
    Object.freeze(
      (
        Array.isArray(
          webs
        )
          ? webs
          : []
      ).map(
        (
          web
        ) =>
          deepFreezeWebValue({
            ...web,
            colourProfileId:
              profile.id,
            strands:
              Object.freeze(
                web.strands.map(
                  (
                    strand
                  ) => {
                    const baseAlpha =
                      normaliseBaseAlpha(
                        strand
                      );

                    return deepFreezeWebValue({
                      ...strand,
                      baseAlpha,
                      alpha:
                        clamp(
                          baseAlpha *
                            configuration.alphaMultiplier,
                          0.05,
                          1
                        ),
                      colour:
                        coloursByKind[
                          strand.kind
                        ],
                      underColour:
                        configuration.underColour
                    });
                  }
                )
              )
          })
      )
    );

  assertWebPopulationIntegrity(
    population,
    {
      expectedSceneId:
        population[0]?.sceneId ??
        null
    }
  );

  return population;
}

function normaliseBaseAlpha(
  strand
) {
  const value =
    Number(
      strand?.baseAlpha ??
      strand?.alpha
    );

  return clamp(
    Number.isFinite(
      value
    )
      ? value
      : 1,
    0.05,
    1
  );
}

function clamp(
  value,
  minimum,
  maximum
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value
    )
  );
}
