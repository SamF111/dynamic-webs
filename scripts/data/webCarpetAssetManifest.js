import webCarpetAssetManifestData from "../../assets/web-carpet/generated/manifest.json" with {
  type:
    "json"
};

import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

export const WEB_CARPET_ASSET_MANIFEST_SCHEMA_VERSION =
  1;

const SUPPORTED_ASSET_CATEGORIES =
  Object.freeze([
    "loose-network",
    "support-arc",
    "dense-knot",
    "fray",
    "faint-sheet"
  ]);

const VALIDATED_MANIFEST =
  validateWebCarpetAssetManifest(
    webCarpetAssetManifestData
  );

export const WEB_CARPET_ASSET_MANIFEST =
  VALIDATED_MANIFEST;

export const WEB_CARPET_ASSETS =
  VALIDATED_MANIFEST.assets;

const ASSETS_BY_CATEGORY =
  new Map(
    SUPPORTED_ASSET_CATEGORIES.map(
      (
        category
      ) => [
        category,
        Object.freeze(
          WEB_CARPET_ASSETS.filter(
            (
              asset
            ) =>
              asset.category ===
                category
          )
        )
      ]
    )
  );

const ASSETS_BY_ID =
  new Map(
    WEB_CARPET_ASSETS.map(
      (
        asset
      ) => [
        asset.id,
        asset
      ]
    )
  );

export function getWebCarpetAsset(
  assetId
) {
  return ASSETS_BY_ID.get(
    String(
      assetId ??
      ""
    ).trim()
  ) ??
    null;
}

export function getWebCarpetAssetsByCategory(
  category
) {
  return ASSETS_BY_CATEGORY.get(
    String(
      category ??
      ""
    ).trim()
  ) ??
    Object.freeze([]);
}

export function validateWebCarpetAssetManifest(
  value
) {
  const root =
    requirePlainObject(
      value,
      "web-carpet asset manifest"
    );

  requireExactKeys(
    root,
    [
      "schemaVersion",
      "generator",
      "rendering",
      "assets"
    ],
    "web-carpet asset manifest"
  );

  const schemaVersion =
    requirePositiveInteger(
      root.schemaVersion,
      "web-carpet asset manifest.schemaVersion"
    );

  if (
    schemaVersion !==
      WEB_CARPET_ASSET_MANIFEST_SCHEMA_VERSION
  ) {
    throw new Error(
      `${MODULE_TITLE} | Web-carpet asset manifest schemaVersion must be ${WEB_CARPET_ASSET_MANIFEST_SCHEMA_VERSION}.`
    );
  }

  const generator =
    requirePlainObject(
      root.generator,
      "web-carpet asset manifest.generator"
    );

  requireText(
    generator.name,
    "web-carpet asset manifest.generator.name"
  );

  requireText(
    generator.version,
    "web-carpet asset manifest.generator.version"
  );

  const rendering =
    requirePlainObject(
      root.rendering,
      "web-carpet asset manifest.rendering"
    );

  if (
    requireText(
      rendering.format,
      "web-carpet asset manifest.rendering.format"
    ).toLowerCase() !==
      "webp"
  ) {
    throw new Error(
      `${MODULE_TITLE} | Web-carpet assets must use WebP.`
    );
  }

  if (
    requireText(
      rendering.colourMode,
      "web-carpet asset manifest.rendering.colourMode"
    ) !==
      "transparent-white"
  ) {
    throw new Error(
      `${MODULE_TITLE} | Web-carpet assets must use transparent-white colour mode.`
    );
  }

  if (
    !Array.isArray(
      root.assets
    ) ||
    root.assets.length ===
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Web-carpet asset manifest.assets must be a non-empty array.`
    );
  }

  const ids =
    new Set();

  const assets =
    root.assets.map(
      (
        raw,
        index
      ) => {
        const context =
          `web-carpet asset manifest.assets.${index}`;

        const asset =
          requirePlainObject(
            raw,
            context
          );

        const id =
          requireText(
            asset.id,
            `${context}.id`
          );

        if (
          ids.has(
            id
          )
        ) {
          throw new Error(
            `${MODULE_TITLE} | Duplicate web-carpet asset ID "${id}".`
          );
        }

        ids.add(
          id
        );

        const category =
          requireText(
            asset.category,
            `${context}.category`
          );

        if (
          !SUPPORTED_ASSET_CATEGORIES.includes(
            category
          )
        ) {
          throw new Error(
            `${MODULE_TITLE} | Unsupported web-carpet asset category "${category}".`
          );
        }

        const file =
          requireText(
            asset.file,
            `${context}.file`
          );

        const modulePath =
          requireText(
            asset.modulePath,
            `${context}.modulePath`
          );

        if (
          !file.toLowerCase().endsWith(
            ".webp"
          ) ||
          !modulePath.toLowerCase().endsWith(
            ".webp"
          )
        ) {
          throw new Error(
            `${MODULE_TITLE} | Web-carpet asset "${id}" must reference WebP files.`
          );
        }

        return deepFreeze({
          id,
          category,
          variant:
            requirePositiveInteger(
              asset.variant,
              `${context}.variant`
            ),
          file,
          modulePath,
          width:
            requirePositiveInteger(
              asset.width,
              `${context}.width`
            ),
          height:
            requirePositiveInteger(
              asset.height,
              `${context}.height`
            ),
          sha256:
            requireSha256(
              asset.sha256,
              `${context}.sha256`
            ),
          weight:
            requirePositiveNumber(
              asset.weight,
              `${context}.weight`
            ),
          recommendedScale:
            requireOrderedPair(
              asset.recommendedScale,
              `${context}.recommendedScale`,
              {
                minimum:
                  0.05,
                maximum:
                  8
              }
            ),
          recommendedAlpha:
            requireOrderedPair(
              asset.recommendedAlpha,
              `${context}.recommendedAlpha`,
              {
                minimum:
                  0,
                maximum:
                  1
              }
            ),
          allowRotation:
            asset.allowRotation ===
              true,
          allowFlipX:
            asset.allowFlipX ===
              true,
          allowFlipY:
            asset.allowFlipY ===
              true,
          tintable:
            asset.tintable ===
              true
        });
      }
    );

  for (
    const category of
    SUPPORTED_ASSET_CATEGORIES
  ) {
    if (
      !assets.some(
        (
          asset
        ) =>
          asset.category ===
            category
      )
    ) {
      throw new Error(
        `${MODULE_TITLE} | Web-carpet asset category "${category}" has no assets.`
      );
    }
  }

  return deepFreeze({
    schemaVersion,
    generator: {
      name:
        String(
          generator.name
        ),
      version:
        String(
          generator.version
        ),
      masterSeed:
        String(
          generator.masterSeed ??
          ""
        ),
      generatedAt:
        String(
          generator.generatedAt ??
          ""
        ),
      deterministicContent:
        generator.deterministicContent ===
          true
    },
    rendering: {
      format:
        "webp",
      colourMode:
        "transparent-white",
      sizePx:
        requirePositiveInteger(
          rendering.sizePx,
          "web-carpet asset manifest.rendering.sizePx"
        ),
      supersample:
        requirePositiveInteger(
          rendering.supersample,
          "web-carpet asset manifest.rendering.supersample"
        )
    },
    assets
  });
}

function requirePlainObject(
  value,
  label
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a plain object.`
    );
  }

  return value;
}

function requireExactKeys(
  value,
  expectedKeys,
  label
) {
  const expected =
    new Set(
      expectedKeys
    );

  const unexpected =
    Object.keys(
      value
    ).filter(
      (
        key
      ) =>
        !expected.has(
          key
        )
    );

  const missing =
    expectedKeys.filter(
      (
        key
      ) =>
        !Object.prototype.hasOwnProperty.call(
          value,
          key
        )
    );

  if (
    unexpected.length >
      0 ||
    missing.length >
      0
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${label} has invalid fields. Unexpected: ${unexpected.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}.`
    );
  }
}

function requireText(
  value,
  label
) {
  const text =
    String(
      value ??
      ""
    ).trim();

  if (
    text.length ===
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a non-empty string.`
    );
  }

  return text;
}

function requirePositiveInteger(
  value,
  label
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isInteger(
      number
    ) ||
    number <=
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a positive integer.`
    );
  }

  return number;
}

function requirePositiveNumber(
  value,
  label
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <=
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a positive number.`
    );
  }

  return number;
}

function requireOrderedPair(
  value,
  label,
  {
    minimum,
    maximum
  }
) {
  if (
    !Array.isArray(
      value
    ) ||
    value.length !==
      2
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must contain two numbers.`
    );
  }

  const first =
    Number(
      value[0]
    );

  const second =
    Number(
      value[1]
    );

  if (
    !Number.isFinite(
      first
    ) ||
    !Number.isFinite(
      second
    ) ||
    first <
      minimum ||
    second >
      maximum ||
    second <
      first
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${label} must be an ordered range between ${minimum} and ${maximum}.`
    );
  }

  return Object.freeze([
    first,
    second
  ]);
}

function requireSha256(
  value,
  label
) {
  const text =
    requireText(
      value,
      label
    ).toLowerCase();

  if (
    !/^[0-9a-f]{64}$/u.test(
      text
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a SHA-256 hash.`
    );
  }

  return text;
}

function deepFreeze(
  value
) {
  if (
    value ===
      null ||
    typeof value !==
      "object" ||
    Object.isFrozen(
      value
    )
  ) {
    return value;
  }

  for (
    const child of
    Object.values(
      value
    )
  ) {
    deepFreeze(
      child
    );
  }

  return Object.freeze(
    value
  );
}
