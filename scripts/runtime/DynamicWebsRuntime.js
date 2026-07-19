import {
  WebRuntimeService
} from "./webs/WebRuntimeService.js";

/**
 * Standalone owner for Dynamic Webs runtime state.
 */
export class DynamicWebsRuntime {
  constructor(
    options = {}
  ) {
    this.runtimeOwnerType =
      "DynamicWebsRuntime";

    this.ready =
      false;

    this.webRuntimeService =
      options.webRuntimeService instanceof
        WebRuntimeService
        ? options.webRuntimeService
        : new WebRuntimeService({
          runtime:
            this
        });
  }

  /** @returns {WebRuntimeService} Generated-web runtime service. */
  getWebRuntimeService() {
    return this.webRuntimeService;
  }

  /**
   * Clear Scene-owned transient state.
   *
   * @returns {boolean} True when generated state existed.
   */
  resetState() {
    return this
      .getWebRuntimeService()
      .clear();
  }

  /** @returns {Readonly<object>} Runtime diagnostics. */
  getDiagnostics() {
    return Object.freeze({
      runtimeOwnerType:
        this.runtimeOwnerType,
      ready:
        this.ready ===
          true,
      webs:
        this
          .getWebRuntimeService()
          .createDiagnosticSnapshot()
    });
  }
}
