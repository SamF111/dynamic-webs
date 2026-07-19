import webGenerationDefaultsData from "../../../data/webs/defaults.json" with {
  type:
    "json"
};

import {
  validateWebGenerationDefaults
} from "../../data/webDataContracts.js";

/**
 * Authoritative validated defaults loaded from data/webs/defaults.json.
 *
 * The checked-in JSON owns authored generation and rendering values. The
 * Scene-dependent seed remains a JavaScript concern and is represented here as
 * null until normaliseWebGenerationConfiguration resolves it.
 */
export const DEFAULT_WEB_GENERATION_CONFIGURATION =
  validateWebGenerationDefaults(
    webGenerationDefaultsData
  );

