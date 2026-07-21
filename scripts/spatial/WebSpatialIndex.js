import {
  calculatePolylineBounds,
  createSpatialCellKeys,
  expandSpatialBounds,
  normaliseSpatialBounds,
  normaliseSpatialPoint,
  pointToPolylineDistance,
  pointToSpatialBoundsDistance,
  spatialBoundsOverlap
} from "./webSpatialGeometry.js";

import {
  cloneFrozenSpatialValue,
  compareSpatialResults,
  normaliseWebSpatialQueryOptions,
  perchEntryMatchesSpatialQuery,
  strandEntryMatchesSpatialQuery,
  webEntryMatchesSpatialQuery
} from "./webSpatialQueries.js";

const DEFAULT_CELL_SIZE_PX = 200;

/**
 * Runtime-only uniform-grid index for immutable generated web geometry.
 *
 * The index owns Maps and Sets internally. Public consumers receive only
 * deeply frozen plain snapshots.
 */
export class WebSpatialIndex {
  constructor({
    cellSizePx = DEFAULT_CELL_SIZE_PX
  } = {}) {
    this.cellSizePx = normalisePositiveNumber(cellSizePx, "spatial cell size");
    this.revision = 0;
    this.snapshotRevision = 0;
    this.sceneId = null;
    this.generationId = 0;
    this.builtAt = null;
    this.buildDurationMs = 0;
    this.queryCount = 0;
    this.queryCountsByKind = Object.create(null);
    this.lastQuery = null;
    this.#resetCollections();
  }

  /** Replace every indexed web, strand and perch after deterministic generation. */
  rebuild(webs, {
    sceneId = null,
    generationId = 0,
    cellSizePx = this.cellSizePx
  } = {}) {
    if (!Array.isArray(webs)) {
      throw new TypeError("Dynamic Webs | WebSpatialIndex.rebuild() requires a web array.");
    }

    const startedAt = now();
    this.cellSizePx = normalisePositiveNumber(cellSizePx, "spatial cell size");
    this.#resetCollections();

    const orderedWebs = [...webs].sort((first, second) =>
      String(first?.id ?? "").localeCompare(String(second?.id ?? ""))
    );

    for (const web of orderedWebs) {
      this.#indexWeb(web);
    }

    this.sceneId = normaliseOptionalIdentifier(sceneId) ??
      normaliseOptionalIdentifier(orderedWebs[0]?.sceneId);
    this.generationId = Number.isInteger(generationId) ? generationId : 0;
    this.revision += 1;
    this.snapshotRevision += 1;
    this.builtAt = Date.now();
    this.buildDurationMs = Math.max(0, now() - startedAt);
    this.queryCount = 0;
    this.queryCountsByKind = Object.create(null);
    this.lastQuery = null;

    return this.createDiagnosticSnapshot();
  }

  /**
   * Refresh full immutable web snapshots after a presentation-only remap.
   * Spatial cells, geometry bounds and index revision remain unchanged.
   */
  refreshSnapshots(webs) {
    if (!Array.isArray(webs)) return false;

    const byId = new Map(webs.map((web) => [String(web?.id ?? ""), web]));
    let changed = false;

    for (const entry of this.webEntries.values()) {
      const replacement = byId.get(entry.id);
      if (!replacement) continue;
      entry.webSnapshot = cloneFrozenSpatialValue(replacement);
      changed = true;
    }

    if (changed) this.snapshotRevision += 1;
    return changed;
  }

  /** Clear every internal collection on canvas teardown or Scene replacement. */
  clear() {
    const hadEntries = this.webEntries.size > 0 ||
      this.strandEntries.size > 0 ||
      this.perchEntries.size > 0;

    this.#resetCollections();
    this.sceneId = null;
    this.generationId = 0;
    this.builtAt = null;
    this.buildDurationMs = 0;
    this.queryCount = 0;
    this.queryCountsByKind = Object.create(null);
    this.lastQuery = null;
    if (hadEntries) this.revision += 1;
    this.snapshotRevision += 1;
    return hadEntries;
  }

  /** Return every web snapshot in stable opaque-ID order. */
  getWebs() {
    return Object.freeze(
      Array.from(this.webEntries.values())
        .sort((first, second) => first.id.localeCompare(second.id))
        .map((entry) => entry.webSnapshot)
    );
  }

  /** Return one immutable web snapshot or null. */
  getWeb(webId) {
    const id = normaliseOptionalIdentifier(webId);
    return id ? this.webEntries.get(id)?.webSnapshot ?? null : null;
  }

  /** Find functional strand geometry near one point. */
  queryNearby(point, options = {}) {
    const query = normaliseWebSpatialQueryOptions(options, {
      point,
      requirePoint: true
    });

    const queryBounds = expandSpatialBounds({
      x: query.point.x,
      y: query.point.y,
      width: 0,
      height: 0
    }, query.maximumDistancePx);

    const candidateIds = this.#collectCellCandidates(this.strandCells, queryBounds);
    const results = [];

    for (const id of candidateIds) {
      const entry = this.strandEntries.get(id);
      if (!strandEntryMatchesSpatialQuery(entry, query)) continue;

      const centrelineDistance = pointToPolylineDistance(query.point, entry.points);
      const distancePx = Math.max(0, centrelineDistance - entry.interactionWidthPx / 2);
      if (distancePx > query.maximumDistancePx) continue;

      results.push(createStrandResult(entry, distancePx));
    }

    results.sort(compareSpatialResults);
    const limited = Object.freeze(results.slice(0, query.limit));
    this.#recordQuery("nearby", candidateIds.size, limited.length);
    return limited;
  }

  /** Query strands whose functional broad-phase bounds overlap one rectangle. */
  queryStrands(bounds, options = {}) {
    const query = normaliseWebSpatialQueryOptions(options, {
      bounds,
      requireBounds: true
    });

    const candidateIds = this.#collectCellCandidates(this.strandCells, query.bounds);
    const results = [];

    for (const id of candidateIds) {
      const entry = this.strandEntries.get(id);
      if (!strandEntryMatchesSpatialQuery(entry, query)) continue;
      if (!spatialBoundsOverlap(entry.interactionBounds, query.bounds)) continue;
      results.push(createStrandResult(entry, null));
    }

    results.sort(compareSpatialResults);
    const limited = Object.freeze(results.slice(0, query.limit));
    this.#recordQuery("strands", candidateIds.size, limited.length);
    return limited;
  }

  /** Find web blueprints compatible with metadata and optional spatial filters. */
  findCompatibleWebs(options = {}) {
    const query = normaliseWebSpatialQueryOptions(options);
    let candidateIds;

    if (query.bounds) {
      candidateIds = this.#collectCellCandidates(this.webCells, query.bounds);
    } else if (query.point) {
      candidateIds = this.#collectCellCandidates(
        this.webCells,
        expandSpatialBounds({
          x: query.point.x,
          y: query.point.y,
          width: 0,
          height: 0
        }, query.maximumDistancePx)
      );
    } else {
      candidateIds = new Set(this.webEntries.keys());
    }

    const results = [];

    for (const id of candidateIds) {
      const entry = this.webEntries.get(id);
      if (!webEntryMatchesSpatialQuery(entry, query)) continue;
      if (query.bounds && !spatialBoundsOverlap(entry.bounds, query.bounds)) continue;

      const distancePx = query.point
        ? pointToSpatialBoundsDistance(query.point, entry.bounds)
        : null;

      if (distancePx !== null && distancePx > query.maximumDistancePx) continue;

      results.push(Object.freeze({
        ...entry.webSnapshot,
        ...(distancePx === null ? {} : { distancePx })
      }));
    }

    results.sort(compareSpatialResults);
    const limited = Object.freeze(results.slice(0, query.limit));
    this.#recordQuery("webs", candidateIds.size, limited.length);
    return limited;
  }

  /** Find immutable level-compatible perch snapshots. */
  findPerches(options = {}) {
    const query = normaliseWebSpatialQueryOptions(options);
    let candidateIds;

    if (query.bounds) {
      candidateIds = this.#collectCellCandidates(this.perchCells, query.bounds);
    } else if (query.point) {
      candidateIds = this.#collectCellCandidates(
        this.perchCells,
        expandSpatialBounds({
          x: query.point.x,
          y: query.point.y,
          width: 0,
          height: 0
        }, query.maximumDistancePx)
      );
    } else {
      candidateIds = new Set(this.perchEntries.keys());
    }

    const results = [];

    for (const id of candidateIds) {
      const entry = this.perchEntries.get(id);
      if (!perchEntryMatchesSpatialQuery(entry, query)) continue;
      if (query.bounds && !pointInsideBounds(entry, query.bounds)) continue;

      const distancePx = query.point
        ? Math.hypot(entry.x - query.point.x, entry.y - query.point.y)
        : null;

      if (distancePx !== null && distancePx > query.maximumDistancePx) continue;
      results.push(createPerchResult(entry, distancePx));
    }

    results.sort(compareSpatialResults);
    const limited = Object.freeze(results.slice(0, query.limit));
    this.#recordQuery("perches", candidateIds.size, limited.length);
    return limited;
  }

  /** Return frozen build and query telemetry without Maps or Sets. */
  createDiagnosticSnapshot() {
    return cloneFrozenSpatialValue({
      active: this.webEntries.size > 0,
      sceneId: this.sceneId,
      generationId: this.generationId,
      revision: this.revision,
      snapshotRevision: this.snapshotRevision,
      cellSizePx: this.cellSizePx,
      builtAt: this.builtAt,
      buildDurationMs: this.buildDurationMs,
      counts: {
        webs: this.webEntries.size,
        strands: this.strandEntries.size,
        perches: this.perchEntries.size,
        webCells: this.webCells.size,
        strandCells: this.strandCells.size,
        perchCells: this.perchCells.size,
        webCellReferences: countCellReferences(this.webCells),
        strandCellReferences: countCellReferences(this.strandCells),
        perchCellReferences: countCellReferences(this.perchCells)
      },
      queries: {
        total: this.queryCount,
        byKind: { ...this.queryCountsByKind },
        last: this.lastQuery
      }
    });
  }

  #indexWeb(web) {
    const id = requireIdentifier(web?.id, "indexed web ID");
    if (this.webEntries.has(id)) {
      throw new Error(`Dynamic Webs | Duplicate indexed web ID "${id}".`);
    }

    const bounds = normaliseSpatialBounds(web?.bounds, `bounds for web "${id}"`);
    const metadata = createWebMetadata(web);
    const entry = {
      ...metadata,
      id,
      bounds,
      webSnapshot: cloneFrozenSpatialValue(web)
    };

    this.webEntries.set(id, entry);
    insertIntoCells(this.webCells, id, createSpatialCellKeys(bounds, this.cellSizePx));

    for (const strand of Array.isArray(web?.strands) ? web.strands : []) {
      this.#indexStrand(web, strand, metadata);
    }

    for (const perch of Array.isArray(web?.perches) ? web.perches : []) {
      this.#indexPerch(web, perch, metadata);
    }
  }

  #indexStrand(web, strand, metadata) {
    const strandId = requireIdentifier(strand?.id, `strand ID for web "${metadata.id}"`);
    if (this.strandEntries.has(strandId)) {
      throw new Error(`Dynamic Webs | Duplicate indexed strand ID "${strandId}".`);
    }

    const points = cloneFrozenSpatialValue(
      (Array.isArray(strand?.points) ? strand.points : [])
        .map((point) => normaliseSpatialPoint(point, `point on strand "${strandId}"`))
    );

    const interactionWidthPx = normalisePositiveNumber(
      strand?.collisionWidthPx,
      `functional interaction width for strand "${strandId}"`
    );

    const geometryBounds = calculatePolylineBounds(points);
    const interactionBounds = expandSpatialBounds(geometryBounds, interactionWidthPx / 2);
    const entry = {
      ...metadata,
      webId: metadata.id,
      strandId,
      localStrandId: String(strand?.localId ?? strandId),
      strandKind: String(strand?.kind ?? ""),
      points,
      geometryBounds,
      interactionBounds,
      interactionWidthPx,
      intact: true
    };

    this.strandEntries.set(strandId, entry);
    insertIntoCells(
      this.strandCells,
      strandId,
      createSpatialCellKeys(interactionBounds, this.cellSizePx)
    );
  }

  #indexPerch(web, perch, metadata) {
    const perchId = requireIdentifier(perch?.id, `perch ID for web "${metadata.id}"`);
    const id = `${metadata.id}:${perchId}`;
    const point = normaliseSpatialPoint(perch, `perch "${perchId}"`);
    const entry = {
      ...metadata,
      webId: metadata.id,
      perchId,
      x: point.x,
      y: point.y,
      rotation: Number.isFinite(Number(perch?.rotation)) ? Number(perch.rotation) : 0,
      intact: true
    };

    this.perchEntries.set(id, entry);
    insertIntoCells(
      this.perchCells,
      id,
      createSpatialCellKeys({ x: point.x, y: point.y, width: 0, height: 0 }, this.cellSizePx)
    );
  }

  #collectCellCandidates(cells, bounds) {
    const ids = new Set();
    for (const key of createSpatialCellKeys(bounds, this.cellSizePx)) {
      for (const id of cells.get(key) ?? []) ids.add(id);
    }
    return ids;
  }

  #recordQuery(kind, candidateCount, resultCount) {
    this.queryCount += 1;
    this.queryCountsByKind[kind] = (this.queryCountsByKind[kind] ?? 0) + 1;
    this.lastQuery = Object.freeze({
      kind,
      candidateCount,
      resultCount,
      executedAt: Date.now()
    });
  }

  #resetCollections() {
    this.webEntries = new Map();
    this.strandEntries = new Map();
    this.perchEntries = new Map();
    this.webCells = new Map();
    this.strandCells = new Map();
    this.perchCells = new Map();
  }
}

function createWebMetadata(web) {
  return {
    id: String(web?.id ?? ""),
    sceneId: String(web?.sceneId ?? ""),
    populationId: String(web?.populationId ?? ""),
    levelId: String(web?.levelId ?? ""),
    elevationBand: cloneFrozenSpatialValue(web?.elevationBand ?? { bottom: null, top: null }),
    webKind: String(web?.kind ?? ""),
    regionIds: cloneFrozenSpatialValue(Array.isArray(web?.regionIds) ? web.regionIds : []),
    regionTags: cloneFrozenSpatialValue(Array.isArray(web?.regionTags) ? web.regionTags : [])
  };
}

function createStrandResult(entry, distancePx) {
  return cloneFrozenSpatialValue({
    webId: entry.webId,
    strandId: entry.strandId,
    localStrandId: entry.localStrandId,
    sceneId: entry.sceneId,
    populationId: entry.populationId,
    levelId: entry.levelId,
    elevationBand: entry.elevationBand,
    webKind: entry.webKind,
    strandKind: entry.strandKind,
    regionIds: entry.regionIds,
    regionTags: entry.regionTags,
    points: entry.points,
    bounds: entry.geometryBounds,
    interactionBounds: entry.interactionBounds,
    interactionWidthPx: entry.interactionWidthPx,
    intact: entry.intact,
    distancePx
  });
}

function createPerchResult(entry, distancePx) {
  return cloneFrozenSpatialValue({
    webId: entry.webId,
    perchId: entry.perchId,
    sceneId: entry.sceneId,
    populationId: entry.populationId,
    levelId: entry.levelId,
    elevationBand: entry.elevationBand,
    webKind: entry.webKind,
    regionIds: entry.regionIds,
    regionTags: entry.regionTags,
    x: entry.x,
    y: entry.y,
    rotation: entry.rotation,
    intact: entry.intact,
    distancePx
  });
}

function insertIntoCells(cells, id, keys) {
  for (const key of keys) {
    let values = cells.get(key);
    if (!values) {
      values = new Set();
      cells.set(key, values);
    }
    values.add(id);
  }
}

function countCellReferences(cells) {
  let total = 0;
  for (const values of cells.values()) total += values.size;
  return total;
}

function pointInsideBounds(point, bounds) {
  const safe = normaliseSpatialBounds(bounds);
  return point.x >= safe.x && point.x <= safe.right &&
    point.y >= safe.y && point.y <= safe.bottom;
}

function requireIdentifier(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new TypeError(`Dynamic Webs | ${label} must be a non-empty identifier.`);
  return text;
}

function normaliseOptionalIdentifier(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalisePositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`Dynamic Webs | ${label} must be a positive finite number.`);
  }
  return number;
}

function now() {
  return typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}
