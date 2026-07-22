import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  createRegionTagsFormValue,
  formatRegionTagsForInput,
  getDynamicWebRegionTags
} from "../config/regionTagConfiguration.js";

import {
  resolveRegionConfigClass,
  resolveRegionDocumentLike
} from "../foundry/webRegionCompatibility.js";

import {
  reportDiagnostic
} from "../diagnostics/diagnosticReporter.js";

const PART_ID = "dynamicWebs";
const TEMPLATE_PATH = `modules/${MODULE_ID}/templates/ui/region-config.hbs`;
const NATIVE_MARKER = Symbol.for(`${MODULE_ID}.regionConfigNativeTabRegistered`);
const RENDER_MARKER = Symbol.for(`${MODULE_ID}.regionConfigRenderPatched`);
const FALLBACK_FIELDSET_SELECTOR = "[data-dynamic-webs-region-fieldset]";
const COOPERATIVE_TAB_MARKER =
  Symbol.for(
    "foundry.region-config.cooperative-tab-navigation"
  );

let renderHookRegistered = false;

/**
 * Register the native Region Configuration tab when its ApplicationV2 contract
 * is available, plus an idempotent DOM-injection fallback for v13/v14 layouts
 * which do not expose that exact contract.
 */
export function registerRegionConfigHooks() {
  let registered = registerRenderHookFallback();
  const RegionConfig = resolveRegionConfigClass();

  if (RegionConfig && RegionConfig[NATIVE_MARKER] !== true) {
    if (supportsNativePartRegistration(RegionConfig)) {
      registerNativeTab(RegionConfig);
      registered = true;
    } else {
      registered = patchRenderFallback(RegionConfig) || registered;
      reportDiagnostic({
        code: "ui.region-config.native-tab-unavailable",
        severity: "info",
        message: "The native Region Configuration part contract was unavailable; Dynamic Webs will use its compatible injected controls.",
        context: {
          regionConfigClass: String(RegionConfig.name ?? "RegionConfig")
        },
        nextAction: "No action is required unless the Dynamic Webs Region controls are absent."
      });
    }
  }

  const loadTemplates =
    globalThis.foundry?.applications?.handlebars?.loadTemplates;

  if (
    typeof loadTemplates ===
      "function"
  ) {
    void loadTemplates(
      [TEMPLATE_PATH]
    );
  } else if (
    typeof globalThis.loadTemplates ===
      "function"
  ) {
    void globalThis.loadTemplates(
      [TEMPLATE_PATH]
    );
  }

  if (registered) {
    console.log(`${MODULE_ID} | Region Configuration integration registered.`);
  }

  return registered;
}

function supportsNativePartRegistration(RegionConfig) {
  return Boolean(
    RegionConfig?.PARTS &&
    typeof RegionConfig.PARTS === "object" &&
    Array.isArray(RegionConfig?.TABS?.sheet?.tabs) &&
    typeof RegionConfig?.prototype?._preparePartContext === "function" &&
    typeof RegionConfig?.prototype?._attachPartListeners === "function"
  );
}

function registerNativeTab(RegionConfig) {
  registerPart(RegionConfig);
  registerTab(RegionConfig);
  wrapContext(RegionConfig);
  wrapListeners(RegionConfig);

  Object.defineProperty(RegionConfig, NATIVE_MARKER, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
}

function registerPart(RegionConfig) {
  const parts = RegionConfig.PARTS;
  if (Object.prototype.hasOwnProperty.call(parts, PART_ID)) return;

  const replacement = {};
  let inserted = false;
  for (const [id, definition] of Object.entries(parts)) {
    if (id === "footer") {
      replacement[PART_ID] = { template: TEMPLATE_PATH, scrollable: [""] };
      inserted = true;
    }
    replacement[id] = definition;
  }
  if (!inserted) replacement[PART_ID] = { template: TEMPLATE_PATH, scrollable: [""] };
  replaceStatic(RegionConfig, "PARTS", replacement);
}

function registerTab(RegionConfig) {
  const tabs = RegionConfig.TABS;
  const group = tabs.sheet;
  if (group.tabs.some((tab) => tab?.id === PART_ID)) return;

  replaceStatic(RegionConfig, "TABS", {
    ...tabs,
    sheet: {
      ...group,
      tabs: [
        ...group.tabs,
        { id: PART_ID, icon: "fa-solid fa-spider", label: MODULE_TITLE }
      ]
    }
  });
}

function wrapContext(RegionConfig) {
  const original = RegionConfig.prototype._preparePartContext;

  RegionConfig.prototype._preparePartContext = async function(partId, context, options) {
    const prepared = await original.call(this, partId, context, options);
    if (partId !== PART_ID) return prepared;
    return {
      ...prepared,
      ...createRegionTagTemplateContext(this)
    };
  };
}

function wrapListeners(RegionConfig) {
  const original = RegionConfig.prototype._attachPartListeners;

  RegionConfig.prototype._attachPartListeners = function(partId, htmlElement, options) {
    const result = original.call(this, partId, htmlElement, options);
    if (partId === PART_ID) activateRegionTagControls(htmlElement);
    return result;
  };
}

function registerRenderHookFallback() {
  if (renderHookRegistered) return false;
  const hooks = globalThis.Hooks;
  if (!hooks || typeof hooks.on !== "function") return false;

  hooks.on("renderRegionConfig", (application, renderedHtml) => {
    scheduleFallbackInjection(application, renderedHtml);
  });
  renderHookRegistered = true;
  return true;
}

function patchRenderFallback(RegionConfig) {
  if (RegionConfig[RENDER_MARKER] === true) return false;

  const original = RegionConfig.prototype?._onRender;
  if (typeof original === "function") {
    RegionConfig.prototype._onRender = function(...args) {
      const result = original.apply(this, args);
      scheduleFallbackInjection(this, args[0]);
      return result;
    };
  }

  Object.defineProperty(RegionConfig, RENDER_MARKER, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
  return true;
}

function scheduleFallbackInjection(application, renderedHtml) {
  const inject = () => {
    try {
      injectRegionTagFieldset(application, renderedHtml);
    } catch (error) {
      reportDiagnostic({
        code: "ui.region-config.inject-failed",
        severity: "warn",
        message: "Dynamic Webs Region Configuration controls could not be injected.",
        context: {
          regionId: resolveRegionDocumentLike(application)?.id ?? null
        },
        nextAction: "Reload the Region Configuration window and inspect the original error if the controls remain absent.",
        error
      });
    }
  };

  if (typeof globalThis.setTimeout === "function") {
    globalThis.setTimeout(inject, 0);
  } else {
    inject();
  }
}

/**
 * Inject fallback controls into Foundry's native Region form. Native-part
 * rendering wins whenever it is present; the fallback never duplicates it.
 */
export function injectRegionTagFieldset(application, renderedHtml = null) {
  const root = resolveRenderedRoot(renderedHtml, application);
  if (!root?.querySelector || !root?.ownerDocument?.createElement) return false;

  const coordinatorInstalled =
    installCooperativeRegionConfigTabs(
      root
    );

  if (
    root.querySelector("[data-dynamic-webs-region-page]") ||
    root.querySelector(FALLBACK_FIELDSET_SELECTOR)
  ) {
    return coordinatorInstalled;
  }

  const form = root.matches?.("form") ? root : root.querySelector("form") ?? root;
  if (!form?.appendChild) return false;

  const context = createRegionTagTemplateContext(application);
  const fieldset = root.ownerDocument.createElement("fieldset");
  fieldset.dataset.dynamicWebsRegionFieldset = "";
  fieldset.innerHTML = `
    <legend>${escapeHtml(MODULE_TITLE)}</legend>
    <input type="hidden" name="flags.${MODULE_ID}.regionTags" value="${escapeHtml(context.regionTagsValue)}" data-dtype="JSON" data-dynamic-webs-region-tags-value>
    <div class="form-group stacked">
      <label>Region tags</label>
      <textarea rows="5" placeholder="area1, crypt, safe-zone" data-dynamic-webs-region-tags-input>${escapeHtml(context.regionTagsInput)}</textarea>
      <p class="hint">Enter comma- or line-separated tags. Dynamic Webs also recognises Ambient Critters Region tags.</p>
    </div>
  `;

  const footer = form.querySelector?.("footer, .form-footer, [data-application-part='footer']");
  if (footer?.parentNode === form && typeof form.insertBefore === "function") {
    form.insertBefore(fieldset, footer);
  } else {
    form.appendChild(fieldset);
  }

  activateRegionTagControls(fieldset);
  return true;
}

/**
 * Coordinate every Region Configuration tab, including pages injected after
 * Foundry initialised its native tab controller.
 *
 * Ambient Critters and Dynamic Webs can both add module pages. A delegated
 * listener is installed on the native navigation and resolves the target page
 * at click time, so either module can be loaded first and tabs added later
 * remain directly switchable.
 */
export function installCooperativeRegionConfigTabs(
  root
) {
  const navigation =
    resolveRegionTabNavigation(
      root
    );

  if (
    !navigation ||
    navigation[
      COOPERATIVE_TAB_MARKER
    ] ===
      true
  ) {
    return false;
  }

  Object.defineProperty(
    navigation,
    COOPERATIVE_TAB_MARKER,
    {
      value:
        true,
      enumerable:
        false,
      configurable:
        false,
      writable:
        false
    }
  );

  navigation.addEventListener(
    "click",
    (
      event
    ) => {
      const control =
        event.target?.closest?.(
          "[data-tab]"
        );

      if (
        !control ||
        !navigation.contains?.(
          control
        )
      ) {
        return;
      }

      const tabId =
        normaliseTabIdentifier(
          control.dataset?.tab ??
          control.getAttribute?.(
            "data-tab"
          )
        );

      if (!tabId) {
        return;
      }

      const group =
        normaliseTabIdentifier(
          control.dataset?.group ??
          control.getAttribute?.(
            "data-group"
          ) ??
          navigation.dataset?.group ??
          navigation.getAttribute?.(
            "data-group"
          )
        ) ??
        "sheet";

      const activate =
        () =>
          activateCooperativeRegionConfigTab({
            root,
            navigation,
            control,
            tabId,
            group
          });

      if (
        typeof globalThis.setTimeout ===
          "function"
      ) {
        globalThis.setTimeout(
          activate,
          0
        );
      } else {
        activate();
      }
    }
  );

  return true;
}

function activateCooperativeRegionConfigTab({
  root,
  navigation,
  control,
  tabId,
  group
}) {
  const page =
    resolveRegionTabPage(
      root,
      navigation,
      tabId,
      group
    );

  if (!page) {
    return false;
  }

  for (
    const candidate of
    Array.from(
      navigation.querySelectorAll?.(
        "[data-tab]"
      ) ??
      []
    )
  ) {
    if (
      resolveTabGroup(
        candidate
      ) !==
        group
    ) {
      continue;
    }

    candidate.classList?.remove(
      "active"
    );

    candidate.setAttribute?.(
      "aria-selected",
      "false"
    );
  }

  for (
    const candidate of
    collectRegionTabPages(
      root,
      navigation,
      group
    )
  ) {
    candidate.classList?.remove(
      "active"
    );
  }

  control.classList?.add(
    "active"
  );

  control.setAttribute?.(
    "aria-selected",
    "true"
  );

  page.classList?.add(
    "active"
  );

  return true;
}

function resolveRegionTabNavigation(
  root
) {
  for (
    const selector of
    [
      'nav.tabs[data-group="sheet"]',
      '.tabs[data-group="sheet"]',
      '[role="tablist"][data-group="sheet"]',
      '[data-application-part="tabs"]',
      '[data-application-part="sheet-tabs"]',
      "nav.tabs",
      ".tabs",
      '[role="tablist"]'
    ]
  ) {
    const candidate =
      root.matches?.(
        selector
      )
        ? root
        : root.querySelector?.(
            selector
          );

    if (
      candidate?.querySelector?.(
        "[data-tab]"
      )
    ) {
      return candidate;
    }
  }

  return null;
}

function resolveRegionTabPage(
  root,
  navigation,
  tabId,
  group
) {
  const escaped =
    escapeAttributeSelector(
      tabId
    );

  for (
    const selector of
    [
      `.tab[data-tab="${escaped}"]`,
      `[data-application-part="${escaped}"].tab`,
      `[data-application-part="${escaped}"]`
    ]
  ) {
    for (
      const candidate of
      Array.from(
        root.querySelectorAll?.(
          selector
        ) ??
        []
      )
    ) {
      if (
        navigation.contains?.(
          candidate
        ) ||
        resolveTabGroup(
          candidate
        ) !==
          group
      ) {
        continue;
      }

      return candidate;
    }
  }

  return null;
}

function collectRegionTabPages(
  root,
  navigation,
  group
) {
  const pages =
    [];

  const seen =
    new Set();

  for (
    const selector of
    [
      ".tab[data-tab]",
      "[data-application-part].tab"
    ]
  ) {
    for (
      const candidate of
      Array.from(
        root.querySelectorAll?.(
          selector
        ) ??
        []
      )
    ) {
      if (
        seen.has(
          candidate
        ) ||
        navigation.contains?.(
          candidate
        ) ||
        resolveTabGroup(
          candidate
        ) !==
          group
      ) {
        continue;
      }

      seen.add(
        candidate
      );

      pages.push(
        candidate
      );
    }
  }

  return pages;
}

function resolveTabGroup(
  element
) {
  return normaliseTabIdentifier(
    element?.dataset?.group ??
    element?.getAttribute?.(
      "data-group"
    )
  ) ??
    "sheet";
}

function normaliseTabIdentifier(
  value
) {
  const text =
    String(
      value ??
      ""
    ).trim();

  return text ||
    null;
}

function escapeAttributeSelector(
  value
) {
  return globalThis.CSS?.escape?.(
    String(
      value
    )
  ) ??
    String(
      value
    ).replace(
      /["\\]/gu,
      "\\$&"
    );
}

export function activateRegionTagControls(htmlElement) {
  const input = htmlElement?.querySelector?.("[data-dynamic-webs-region-tags-input]");
  const hidden = htmlElement?.querySelector?.("[data-dynamic-webs-region-tags-value]");
  if (!input || !hidden) return false;

  const sync = () => {
    hidden.value = createRegionTagsFormValue(input.value);
    const EventConstructor = globalThis.Event;
    if (typeof EventConstructor === "function") {
      hidden.dispatchEvent?.(new EventConstructor("change", { bubbles: true }));
    }
  };
  input.addEventListener("input", sync);
  input.addEventListener("change", sync);
  sync();
  return true;
}

function createRegionTagTemplateContext(application) {
  const region = resolveRegionDocumentLike(application);
  const tags = getDynamicWebRegionTags(region);
  return {
    regionTagsInput: formatRegionTagsForInput(tags),
    regionTagsValue: createRegionTagsFormValue(tags)
  };
}

function resolveRenderedRoot(renderedHtml, application) {
  for (const candidate of [
    renderedHtml,
    renderedHtml?.[0],
    application?.element,
    application?.element?.[0]
  ]) {
    if (candidate?.querySelector) return candidate;
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function replaceStatic(target, property, value) {
  Object.defineProperty(target, property, {
    value,
    configurable: true,
    enumerable: true,
    writable: true
  });
}
