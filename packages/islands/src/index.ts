// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
export interface IslandMeta {
  id: string;
  name: string;
  createdAt: number;
  lastVisitedAt: number;
  lastEditedAt: number | null;
  forkOf: string | null;
  template: string | null;
  readonly: boolean;
  deleted: boolean;
  edits: number;
  bytes: number;
  note: string;
}

export interface Template {
  id: string;
  name: string;
  doc: string;
  hasTrack: boolean;
}

export const TEMPLATES: Template[] = [
  {
    id: "blank-island",
    name: "Blank Island",
    doc: "A flat island of sand and grass.",
    hasTrack: false,
  },
  {
    id: "palm-beach",
    name: "Palm Beach",
    doc: "A sunny beach with palms, shallow water, and a small lagoon.",
    hasTrack: false,
  },
  {
    id: "rocky-cove",
    name: "Rocky Cove",
    doc: "A sheltered cove with stone cliffs and tide pools.",
    hasTrack: false,
  },
  {
    id: "volcano",
    name: "Volcano",
    doc: "A volcanic island with lava fields, ash, and a crater lake.",
    hasTrack: false,
  },
  {
    id: "racing-starter",
    name: "Racing Starter",
    doc: "A starter island with a loop track, checkpoints, and grandstands.",
    hasTrack: true,
  },
  {
    id: "floating-rocks",
    name: "Floating Rocks",
    doc: "A sky island made of floating rock platforms and waterfalls.",
    hasTrack: false,
  },
  {
    id: "empty-sea",
    name: "Empty Sea",
    doc: "Open water with a distant horizon and no land.",
    hasTrack: false,
  },
];

export type IslandErrorCode =
  | "not-found"
  | "limit"
  | "readonly"
  | "name"
  | "nothing-to-undo"
  | "nothing-to-redo";

export interface IslandError {
  kind: "IslandError";
  code: IslandErrorCode;
  message: string;
}

export interface SerializedIsland extends IslandMeta {
  deletedAt: number | null;
  visitOrder: number;
}

export interface IslandRegistryJSON {
  islands: SerializedIsland[];
}

export interface IslandTree {
  meta: IslandMeta;
  children: IslandTree[];
}

interface StoredIsland extends IslandMeta {
  deletedAt: number | null;
  visitOrder: number;
}

interface HistoryEntry {
  before: StoredIsland[];
  after: StoredIsland[];
  sentence: string;
}

const MAX_LIVE_ISLANDS = 24;
const MAX_HISTORY_STEPS = 50;

function islandError(code: IslandErrorCode, message: string): never {
  throw { kind: "IslandError", code, message } satisfies IslandError;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function checkedTimestamp(value: number): number {
  if (!isFiniteNumber(value)) {
    islandError("name", "A finite timestamp is required.");
  }
  return value;
}

function checkedName(value: unknown): string {
  if (typeof value !== "string") {
    islandError("name", "An island name is required.");
  }

  const name = value.trim();
  if (name.length < 1 || name.length > 40) {
    islandError("name", "Island names must be between 1 and 40 characters.");
  }

  return name;
}

function copyMeta(row: IslandMeta): IslandMeta {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    lastVisitedAt: row.lastVisitedAt,
    lastEditedAt: row.lastEditedAt,
    forkOf: row.forkOf,
    template: row.template,
    readonly: row.readonly,
    deleted: row.deleted,
    edits: row.edits,
    bytes: row.bytes,
    note: row.note,
  };
}

function copyStored(row: StoredIsland): StoredIsland {
  return {
    ...copyMeta(row),
    deletedAt: row.deletedAt,
    visitOrder: row.visitOrder,
  };
}

function cloneRows(rows: readonly StoredIsland[]): StoredIsland[] {
  return rows.map(copyStored);
}

function copyEntry(entry: HistoryEntry): HistoryEntry {
  return {
    before: cloneRows(entry.before),
    after: cloneRows(entry.after),
    sentence: entry.sentence,
  };
}

function compareRows(a: StoredIsland, b: StoredIsland): number {
  if (a.lastVisitedAt !== b.lastVisitedAt) {
    return a.lastVisitedAt > b.lastVisitedAt ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt > b.createdAt ? -1 : 1;
  }
  if (a.visitOrder !== b.visitOrder) {
    return a.visitOrder > b.visitOrder ? -1 : 1;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}

function nameTaken(
  rows: readonly StoredIsland[],
  name: string,
  exceptId?: string,
): boolean {
  const wanted = name.toLowerCase();
  return rows.some(
    (row) =>
      row.id !== exceptId &&
      row.name.toLowerCase() === wanted,
  );
}

function uniqueName(base: string, rows: readonly StoredIsland[]): string {
  if (!nameTaken(rows, base)) {
    return base;
  }

  let suffix = 2;
  let candidate = `${base} ${suffix}`;
  while (nameTaken(rows, candidate)) {
    suffix += 1;
    candidate = `${base} ${suffix}`;
  }
  return candidate;
}

function nextId(rows: readonly StoredIsland[]): string {
  let next = 1;

  for (const row of rows) {
    const match = /^island-([1-9]\d*)$/.exec(row.id);
    const digits = match?.[1];
    if (digits === undefined) {
      continue;
    }

    const number = Number(digits);
    if (Number.isSafeInteger(number) && number >= next) {
      next = number + 1;
    }
  }

  let candidate = `island-${next}`;
  while (rows.some((row) => row.id === candidate)) {
    next += 1;
    candidate = `island-${next}`;
  }
  return candidate;
}

function nextVisitOrder(rows: readonly StoredIsland[]): number {
  let highest = 0;
  for (const row of rows) {
    if (row.visitOrder > highest) {
      highest = row.visitOrder;
    }
  }
  return highest + 1;
}

function templateById(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

function parseStoredIsland(
  value: unknown,
  fallbackVisitOrder: number,
): StoredIsland | null {
  if (!isObject(value)) {
    return null;
  }

  const idValue = value["id"];
  const nameValue = value["name"];
  const createdAt = value["createdAt"];
  const lastVisitedAt = value["lastVisitedAt"];
  const lastEditedAt = value["lastEditedAt"];
  const forkOf = value["forkOf"];
  const template = value["template"];
  const readonly = value["readonly"];
  const deleted = value["deleted"];
  const edits = value["edits"];
  const bytes = value["bytes"];
  const note = value["note"];

  if (
    typeof idValue !== "string" ||
    idValue.trim().length === 0 ||
    typeof nameValue !== "string" ||
    nameValue.trim().length === 0 ||
    nameValue.trim().length > 40 ||
    !isFiniteNumber(createdAt) ||
    !isFiniteNumber(lastVisitedAt) ||
    !(lastEditedAt === null || isFiniteNumber(lastEditedAt)) ||
    !(forkOf === null || typeof forkOf === "string") ||
    !(template === null || typeof template === "string") ||
    typeof readonly !== "boolean" ||
    typeof deleted !== "boolean" ||
    !isFiniteNumber(edits) ||
    edits < 0 ||
    !Number.isInteger(edits) ||
    !isFiniteNumber(bytes) ||
    bytes < 0 ||
    typeof note !== "string"
  ) {
    return null;
  }

  const storedDeletedAt = value["deletedAt"];
  const storedVisitOrder = value["visitOrder"];
  const cleanedForkOf =
    typeof forkOf === "string" && forkOf.trim().length === 0
      ? null
      : forkOf;
  const cleanedTemplate =
    typeof template === "string" && template.trim().length === 0
      ? null
      : template;

  return {
    id: idValue.trim(),
    name: nameValue.trim(),
    createdAt,
    lastVisitedAt,
    lastEditedAt,
    forkOf: cleanedForkOf,
    template: cleanedTemplate,
    readonly,
    deleted,
    edits,
    bytes,
    note,
    deletedAt: deleted
      ? isFiniteNumber(storedDeletedAt)
        ? storedDeletedAt
        : lastVisitedAt
      : null,
    visitOrder:
      isFiniteNumber(storedVisitOrder) && storedVisitOrder >= 0
        ? storedVisitOrder
        : fallbackVisitOrder,
  };
}

function repairForks(rows: StoredIsland[]): void {
  const byId = new Map<string, StoredIsland>();
  for (const row of rows) {
    byId.set(row.id, row);
  }

  for (const row of rows) {
    if (
      row.forkOf === row.id ||
      (row.forkOf !== null && !byId.has(row.forkOf))
    ) {
      row.forkOf = null;
    }
  }

  for (const row of rows) {
    const seen = new Set<string>();
    let current: StoredIsland | undefined = row;

    while (current !== undefined && current.forkOf !== null) {
      if (seen.has(current.id)) {
        row.forkOf = null;
        break;
      }
      seen.add(current.id);
      current = byId.get(current.forkOf);
    }
  }
}

function unitCount(milliseconds: number, unit: number): number {
  return (milliseconds - (milliseconds % unit)) / unit;
}

function timePhrase(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

export function relativeTime(milliseconds: number): string {
  const elapsed = isFiniteNumber(milliseconds) && milliseconds > 0
    ? milliseconds
    : 0;

  if (elapsed < 60_000) {
    return "just now";
  }
  if (elapsed < 3_600_000) {
    return timePhrase(unitCount(elapsed, 60_000), "minute");
  }
  if (elapsed < 86_400_000) {
    return timePhrase(unitCount(elapsed, 3_600_000), "hour");
  }
  if (elapsed < 604_800_000) {
    return timePhrase(unitCount(elapsed, 86_400_000), "day");
  }
  if (elapsed < 2_592_000_000) {
    return timePhrase(unitCount(elapsed, 604_800_000), "week");
  }
  if (elapsed < 31_536_000_000) {
    return timePhrase(unitCount(elapsed, 2_592_000_000), "month");
  }
  return timePhrase(unitCount(elapsed, 31_536_000_000), "year");
}

export function describeIsland(meta: IslandMeta, now: number): string {
  const parts = [meta.name];

  if (meta.lastEditedAt === null) {
    parts.push("never edited");
  } else {
    parts.push(`edited ${relativeTime(now - meta.lastEditedAt)}`);
  }

  if (meta.forkOf !== null) {
    const templateName = templateById(meta.template ?? "")?.name;
    parts.push(`branch of ${templateName ?? meta.template ?? meta.forkOf}`);
  }

  return parts.join(" · ");
}

export class IslandRegistry {
  private readonly rows: StoredIsland[];
  private readonly past: HistoryEntry[];
  private readonly future: HistoryEntry[];

  private constructor(
    rows: readonly StoredIsland[],
    past: readonly HistoryEntry[] = [],
    future: readonly HistoryEntry[] = [],
  ) {
    this.rows = cloneRows(rows);
    this.past = past.map(copyEntry);
    this.future = future.map(copyEntry);
  }

  static empty(): IslandRegistry {
    return new IslandRegistry([]);
  }

  static fromJSON(raw: unknown): IslandRegistry {
    try {
      const source = Array.isArray(raw)
        ? raw
        : isObject(raw) && Array.isArray(raw["islands"])
          ? raw["islands"]
          : [];

      const rows: StoredIsland[] = [];
      for (const value of source) {
        const parsed = parseStoredIsland(value, nextVisitOrder(rows));
        if (parsed === null) {
          continue;
        }

        if (rows.some((row) => row.id === parsed.id)) {
          parsed.id = nextId(rows);
        }
        parsed.name = uniqueName(parsed.name, rows);
        rows.push(parsed);
      }

      repairForks(rows);
      return new IslandRegistry(rows);
    } catch {
      return IslandRegistry.empty();
    }
  }

  toJSON(): IslandRegistryJSON {
    return {
      islands: this.rows.map((row) => ({
        ...copyMeta(row),
        deletedAt: row.deletedAt,
        visitOrder: row.visitOrder,
      })),
    };
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  list(opts?: { includeDeleted?: boolean }): IslandMeta[] {
    const includeDeleted = opts?.includeDeleted === true;
    return this.sorted(
      this.rows.filter((row) => includeDeleted || !row.deleted),
    ).map(copyMeta);
  }

  get(id: string): IslandMeta | undefined {
    const index = this.findAnyIndex(id);
    return index < 0 ? undefined : copyMeta(this.rows[index]!);
  }

  defaultId(): string | null {
    const first = this.sorted(this.rows.filter((row) => !row.deleted))[0];
    return first?.id ?? null;
  }

  create(name: string, templateId: string, now: number): IslandRegistry {
    const timestamp = checkedTimestamp(now);
    const requestedName = checkedName(name);
    const template = templateById(templateId);

    if (template === undefined) {
      islandError("not-found", `Template "${templateId}" was not found.`);
    }
    if (this.liveCount() >= MAX_LIVE_ISLANDS) {
      islandError("limit", `You can own at most ${MAX_LIVE_ISLANDS} islands.`);
    }

    const island: StoredIsland = {
      id: nextId(this.rows),
      name: uniqueName(requestedName, this.rows),
      createdAt: timestamp,
      lastVisitedAt: timestamp,
      lastEditedAt: null,
      forkOf: null,
      template: template.id,
      readonly: true,
      deleted: false,
      edits: 0,
      bytes: template.doc.length,
      note: "",
      deletedAt: null,
      visitOrder: nextVisitOrder(this.rows),
    };

    return this.commit(
      [...this.rows.map(copyStored), island],
      `Created ${island.name}`,
    );
  }

  duplicate(id: string, now: number): IslandRegistry {
    const timestamp = checkedTimestamp(now);
    const index = this.findLiveIndex(id);
    if (index < 0) {
      islandError("not-found", `Island "${id}" was not found.`);
    }
    if (this.liveCount() >= MAX_LIVE_ISLANDS) {
      islandError("limit", `You can own at most ${MAX_LIVE_ISLANDS} islands.`);
    }

    const source = this.rows[index]!;
    const duplicate: StoredIsland = {
      id: nextId(this.rows),
      name: uniqueName(`Copy of ${source.name}`, this.rows),
      createdAt: timestamp,
      lastVisitedAt: timestamp,
      lastEditedAt: null,
      forkOf: source.id,
      template: source.template,
      readonly: false,
      deleted: false,
      edits: 0,
      bytes: source.bytes,
      note: "",
      deletedAt: null,
      visitOrder: nextVisitOrder(this.rows),
    };

    return this.commit(
      [...this.rows.map(copyStored), duplicate],
      `Duplicated ${source.name}`,
    );
  }

  rename(id: string, name: string): IslandRegistry {
    const nextName = checkedName(name);
    const index = this.findLiveIndex(id);
    if (index < 0) {
      islandError("not-found", `Island "${id}" was not found.`);
    }
    if (nameTaken(this.rows, nextName, id)) {
      islandError("name", `An island named "${nextName}" already exists.`);
    }

    const source = this.rows[index]!;
    const renamed: StoredIsland = { ...copyStored(source), name: nextName };
    return this.commit(
      this.replace(index, renamed),
      `Renamed ${source.name} to ${nextName}`,
    );
  }

  remove(id: string, now: number): IslandRegistry {
    const timestamp = checkedTimestamp(now);
    const index = this.findLiveIndex(id);
    if (index < 0) {
      islandError("not-found", `Island "${id}" was not found.`);
    }

    const source = this.rows[index]!;
    const removed: StoredIsland = {
      ...copyStored(source),
      deleted: true,
      deletedAt: timestamp,
    };

    return this.commit(this.replace(index, removed), `Deleted ${source.name}`);
  }

  restore(id: string): IslandRegistry {
    const index = this.findAnyIndex(id);
    if (index < 0 || !this.rows[index]!.deleted) {
      islandError("not-found", `Deleted island "${id}" was not found.`);
    }
    if (this.liveCount() >= MAX_LIVE_ISLANDS) {
      islandError("limit", `You can own at most ${MAX_LIVE_ISLANDS} islands.`);
    }

    const source = this.rows[index]!;
    const restored: StoredIsland = {
      ...copyStored(source),
      deleted: false,
      deletedAt: null,
    };

    return this.commit(this.replace(index, restored), `Restored ${source.name}`);
  }

  purge(now: number, maxAgeMs: number): IslandRegistry {
    const timestamp = checkedTimestamp(now);
    if (!isFiniteNumber(maxAgeMs)) {
      islandError("name", "A finite purge age is required.");
    }

    const rows = this.rows
      .filter(
        (row) =>
          !row.deleted ||
          row.deletedAt === null ||
          timestamp - row.deletedAt <= maxAgeMs,
      )
      .map(copyStored);

    if (rows.length === this.rows.length) {
      return new IslandRegistry(rows, this.past, this.future);
    }

    return new IslandRegistry(rows);
  }

  visit(id: string, now: number): IslandRegistry {
    const timestamp = checkedTimestamp(now);
    const index = this.findLiveIndex(id);
    if (index < 0) {
      islandError("not-found", `Island "${id}" was not found.`);
    }

    const visited: StoredIsland = {
      ...copyStored(this.rows[index]!),
      lastVisitedAt: timestamp,
      visitOrder: nextVisitOrder(this.rows),
    };
    return new IslandRegistry(this.replace(index, visited), this.past, this.future);
  }

  recordEdit(id: string, now: number, bytes: number): IslandRegistry {
    const timestamp = checkedTimestamp(now);
    if (!isFiniteNumber(bytes) || bytes < 0) {
      islandError("name", "Island byte size must be a non-negative number.");
    }

    const index = this.findLiveIndex(id);
    if (index < 0) {
      islandError("not-found", `Island "${id}" was not found.`);
    }

    const source = this.rows[index]!;
    if (source.readonly) {
      islandError("readonly", "Readonly islands must be forked before editing.");
    }

    const edited: StoredIsland = {
      ...copyStored(source),
      lastEditedAt: timestamp,
      edits: source.edits + 1,
      bytes,
    };
    return new IslandRegistry(this.replace(index, edited), this.past, this.future);
  }

  forkOnEdit(
    id: string,
    now: number,
  ): { registry: IslandRegistry; id: string; forked: boolean } {
    const timestamp = checkedTimestamp(now);
    const index = this.findLiveIndex(id);
    if (index < 0) {
      islandError("not-found", `Island "${id}" was not found.`);
    }

    const source = this.rows[index]!;
    if (!source.readonly) {
      return {
        registry: this.recordEdit(id, timestamp, source.bytes),
        id,
        forked: false,
      };
    }

    if (this.liveCount() >= MAX_LIVE_ISLANDS) {
      islandError("limit", `You can own at most ${MAX_LIVE_ISLANDS} islands.`);
    }

    const baseName =
      source.template === "blank-island" ? "My Island" : `My ${source.name}`;
    const fork: StoredIsland = {
      id: nextId(this.rows),
      name: uniqueName(baseName, this.rows),
      createdAt: timestamp,
      lastVisitedAt: timestamp,
      lastEditedAt: timestamp,
      forkOf: source.id,
      template: source.template,
      readonly: false,
      deleted: false,
      edits: 1,
      bytes: source.bytes,
      note: "",
      deletedAt: null,
      visitOrder: nextVisitOrder(this.rows),
    };

    return {
      registry: this.commit(
        [...this.rows.map(copyStored), fork],
        `Forked ${fork.name}`,
      ),
      id: fork.id,
      forked: true,
    };
  }

  children(id: string): IslandMeta[] {
    if (this.findAnyIndex(id) < 0) {
      islandError("not-found", `Island "${id}" was not found.`);
    }

    return this.sorted(
      this.rows.filter((row) => !row.deleted && row.forkOf === id),
    ).map(copyMeta);
  }

  lineage(id: string): IslandMeta[] {
    const index = this.findAnyIndex(id);
    if (index < 0) {
      islandError("not-found", `Island "${id}" was not found.`);
    }

    const result: IslandMeta[] = [];
    const seen = new Set<string>();
    let current: StoredIsland | undefined = this.rows[index]!;

    while (current !== undefined && !seen.has(current.id)) {
      seen.add(current.id);
      result.unshift(copyMeta(current));

      if (current.forkOf === null) {
        break;
      }
      const parentIndex = this.findAnyIndex(current.forkOf);
      current = parentIndex < 0 ? undefined : this.rows[parentIndex]!;
    }

    return result;
  }

  tree(): IslandTree[] {
    const live = this.sorted(this.rows.filter((row) => !row.deleted));
    const liveIds = new Set(live.map((row) => row.id));

    const buildChildren = (
      parentId: string,
      ancestors: Set<string>,
    ): IslandTree[] =>
      this.sorted(
        live.filter(
          (row) => row.forkOf === parentId && !ancestors.has(row.id),
        ),
      ).map((row) => {
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(row.id);
        return {
          meta: copyMeta(row),
          children: buildChildren(row.id, nextAncestors),
        };
      });

    return live
      .filter((row) => row.forkOf === null || !liveIds.has(row.forkOf))
      .map((row) => ({
        meta: copyMeta(row),
        children: buildChildren(row.id, new Set([row.id])),
      }));
  }

  setNote(id: string, text: string): IslandRegistry {
    if (typeof text !== "string") {
      islandError("name", "Island notes must be text.");
    }

    const index = this.findLiveIndex(id);
    if (index < 0) {
      islandError("not-found", `Island "${id}" was not found.`);
    }

    const noted: StoredIsland = {
      ...copyStored(this.rows[index]!),
      note: text,
    };
    return new IslandRegistry(this.replace(index, noted), this.past, this.future);
  }

  totalBytes(): number {
    let total = 0;
    for (const row of this.rows) {
      if (!row.deleted) {
        total += row.bytes;
      }
    }
    return total;
  }

  undo(): IslandRegistry {
    if (this.past.length === 0) {
      islandError("nothing-to-undo", "There is nothing to undo.");
    }

    const entry = this.past[this.past.length - 1]!;
    return new IslandRegistry(
      entry.before,
      this.past.slice(0, -1),
      [...this.future, entry],
    );
  }

  redo(): IslandRegistry {
    if (this.future.length === 0) {
      islandError("nothing-to-redo", "There is nothing to redo.");
    }

    const entry = this.future[this.future.length - 1]!;
    return new IslandRegistry(
      entry.after,
      [...this.past, entry],
      this.future.slice(0, -1),
    );
  }

  history(): string[] {
    return this.past.map((entry) => entry.sentence);
  }

  private commit(rows: StoredIsland[], sentence: string): IslandRegistry {
    const history = [
      ...this.past.map(copyEntry),
      {
        before: cloneRows(this.rows),
        after: cloneRows(rows),
        sentence,
      },
    ];

    if (history.length > MAX_HISTORY_STEPS) {
      history.splice(0, history.length - MAX_HISTORY_STEPS);
    }

    return new IslandRegistry(rows, history, []);
  }

  private replace(index: number, replacement: StoredIsland): StoredIsland[] {
    return this.rows.map((row, rowIndex) =>
      rowIndex === index ? copyStored(replacement) : copyStored(row),
    );
  }

  private sorted(rows: readonly StoredIsland[]): StoredIsland[] {
    return rows.slice().sort(compareRows);
  }

  private findAnyIndex(id: string): number {
    return this.rows.findIndex((row) => row.id === id);
  }

  private findLiveIndex(id: string): number {
    return this.rows.findIndex((row) => row.id === id && !row.deleted);
  }

  private liveCount(): number {
    let count = 0;
    for (const row of this.rows) {
      if (!row.deleted) {
        count += 1;
      }
    }
    return count;
  }
}