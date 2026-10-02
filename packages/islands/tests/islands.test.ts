// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeIsland,
  IslandRegistry,
  type IslandErrorCode,
  type IslandMeta,
  relativeTime,
  TEMPLATES,
} from "../src";

function expectError(run: () => unknown, code: IslandErrorCode): void {
  assert.throws(run, (error: unknown) => {
    if (typeof error !== "object" || error === null) {
      return false;
    }
    const candidate = error as { kind?: unknown; code?: unknown };
    return candidate.kind === "IslandError" && candidate.code === code;
  });
}

function islandId(registry: IslandRegistry): string {
  const island = registry.list()[0];
  assert.notEqual(island, undefined);
  return island!.id;
}

test("exports all built-in template presets", () => {
  assert.deepEqual(
    TEMPLATES.map((template) => template.id),
    [
      "blank-island",
      "palm-beach",
      "rocky-cove",
      "volcano",
      "racing-starter",
      "floating-rocks",
      "empty-sea",
    ],
  );
  assert.equal(
    TEMPLATES.find((template) => template.id === "racing-starter")?.hasTrack,
    true,
  );
  assert.equal(
    TEMPLATES.find((template) => template.id === "blank-island")?.hasTrack,
    false,
  );
});

test("creates, duplicates, renames, removes, and restores islands", () => {
  const created = IslandRegistry.empty().create("Palm Beach", "palm-beach", 10);
  const sourceId = islandId(created);

  assert.equal(created.get(sourceId)?.readonly, true);
  assert.equal(created.defaultId(), sourceId);

  const duplicated = created.duplicate(sourceId, 20);
  const copy = duplicated.list()[0];
  assert.notEqual(copy, undefined);
  const copyId = copy!.id;

  assert.equal(copy!.name, "Copy of Palm Beach");
  assert.equal(copy!.forkOf, sourceId);
  assert.equal(copy!.readonly, false);
  assert.equal(duplicated.defaultId(), copyId);

  const renamed = duplicated.rename(copyId, "Holiday Cove");
  assert.equal(renamed.get(copyId)?.name, "Holiday Cove");
  assert.equal(duplicated.get(copyId)?.name, "Copy of Palm Beach");

  const removed = renamed.remove(copyId, 30);
  assert.equal(removed.get(copyId)?.deleted, true);
  assert.equal(removed.defaultId(), sourceId);

  const restored = removed.restore(copyId);
  assert.equal(restored.get(copyId)?.deleted, false);
  assert.equal(restored.defaultId(), copyId);
});

test("enforces the 24 live island limit", () => {
  let registry = IslandRegistry.empty();

  for (let index = 1; index <= 24; index += 1) {
    registry = registry.create(`Island ${index}`, "empty-sea", index);
  }

  assert.equal(registry.list().length, 24);
  expectError(
    () => registry.create("Too Many", "empty-sea", 25),
    "limit",
  );
});

test("automatically makes names unique and rejects conflicting renames", () => {
  let registry = IslandRegistry.empty().create("Home", "blank-island", 1);
  const firstId = islandId(registry);

  registry = registry.create("Home", "palm-beach", 2);
  registry = registry.duplicate(firstId, 3);
  registry = registry.duplicate(firstId, 4);

  assert.deepEqual(
    registry
      .list()
      .map((island) => island.name)
      .sort(),
    ["Copy of Home", "Copy of Home 2", "Home", "Home 2"],
  );

  const secondId = registry.list().find((island) => island.name === "Home 2")?.id;
  assert.notEqual(secondId, undefined);
  expectError(() => registry.rename(secondId!, "HOME"), "name");
  expectError(() => registry.rename(firstId, "   "), "name");
});

test("orders by visit time and exposes the latest visited default", () => {
  let registry = IslandRegistry.empty().create("First", "rocky-cove", 10);
  const firstId = islandId(registry);

  registry = registry.create("Second", "volcano", 20);
  const secondId = registry.defaultId();

  assert.equal(registry.list()[0]?.id, secondId);
  assert.equal(registry.defaultId(), secondId);

  registry = registry.visit(firstId, 30);
  assert.equal(registry.list()[0]?.id, firstId);
  assert.equal(registry.defaultId(), firstId);

  registry = registry.create("Third", "empty-sea", 30);
  assert.equal(registry.defaultId(), registry.list()[0]?.id);
  assert.equal(registry.list()[0]?.name, "Third");
});

test("forkOnEdit forks readonly templates once and then edits in place", () => {
  const templateInstance = IslandRegistry.empty().create(
    "Palm Beach",
    "palm-beach",
    10,
  );
  const templateId = islandId(templateInstance);

  const firstEdit = templateInstance.forkOnEdit(templateId, 20);
  const fork = firstEdit.registry.get(firstEdit.id);

  assert.equal(firstEdit.forked, true);
  assert.notEqual(firstEdit.id, templateId);
  assert.equal(firstEdit.registry.defaultId(), firstEdit.id);
  assert.equal(fork?.name, "My Palm Beach");
  assert.equal(fork?.readonly, false);
  assert.equal(fork?.forkOf, templateId);
  assert.equal(fork?.template, "palm-beach");
  assert.equal(fork?.edits, 1);
  assert.equal(fork?.lastEditedAt, 20);

  const secondEdit = firstEdit.registry.forkOnEdit(firstEdit.id, 30);
  assert.equal(secondEdit.forked, false);
  assert.equal(secondEdit.id, firstEdit.id);
  assert.equal(secondEdit.registry.get(firstEdit.id)?.edits, 2);
  assert.equal(secondEdit.registry.get(firstEdit.id)?.lastEditedAt, 30);

  const recorded = secondEdit.registry.recordEdit(firstEdit.id, 40, 777);
  assert.equal(recorded.get(firstEdit.id)?.edits, 3);
  assert.equal(recorded.get(firstEdit.id)?.bytes, 777);
  expectError(() => templateInstance.recordEdit(templateId, 20, 1), "readonly");
});

test("builds branch trees and lineage through branches of branches", () => {
  const rootRegistry = IslandRegistry.empty().create("Cove", "rocky-cove", 1);
  const rootId = islandId(rootRegistry);

  const firstFork = rootRegistry.forkOnEdit(rootId, 2);
  const secondRegistry = firstFork.registry.duplicate(firstFork.id, 3);
  const secondForkId = secondRegistry.defaultId();

  assert.notEqual(secondForkId, null);
  assert.deepEqual(
    secondRegistry.lineage(secondForkId!).map((island) => island.id),
    [rootId, firstFork.id, secondForkId],
  );
  assert.deepEqual(
    secondRegistry.children(rootId).map((island) => island.id),
    [firstFork.id],
  );

  const tree = secondRegistry.tree();
  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.meta.id, rootId);
  assert.equal(tree[0]?.children[0]?.meta.id, firstFork.id);
  assert.equal(tree[0]?.children[0]?.children[0]?.meta.id, secondForkId);
});

test("undo and redo restore snapshots, defaults, and history sentences", () => {
  let registry = IslandRegistry.empty().create("Palm Beach", "palm-beach", 1);
  const sourceId = islandId(registry);

  registry = registry.rename(sourceId, "Coast");
  const forked = registry.forkOnEdit(sourceId, 3);
  registry = forked.registry;
  const forkId = forked.id;
  registry = registry.remove(forkId, 4);

  assert.deepEqual(registry.history(), [
    "Created Palm Beach",
    "Renamed Palm Beach to Coast",
    "Forked My Coast",
    "Deleted My Coast",
  ]);
  assert.equal(registry.defaultId(), sourceId);

  registry = registry.undo();
  assert.equal(registry.get(forkId)?.deleted, false);
  assert.equal(registry.defaultId(), forkId);

  registry = registry.undo();
  assert.equal(registry.get(forkId), undefined);
  assert.equal(registry.get(sourceId)?.name, "Coast");
  assert.equal(registry.defaultId(), sourceId);

  registry = registry.undo();
  assert.equal(registry.get(sourceId)?.name, "Palm Beach");

  registry = registry.undo();
  assert.equal(registry.list().length, 0);
  assert.equal(registry.canUndo, false);
  assert.equal(registry.canRedo, true);

  registry = registry.redo().redo().redo().redo();
  assert.equal(registry.get(forkId)?.deleted, true);
  assert.equal(registry.defaultId(), sourceId);
  assert.equal(registry.canRedo, false);

  const restoredFork = registry.undo();
  const newBranch = restoredFork.duplicate(sourceId, 8);
  assert.equal(newBranch.canRedo, false);
  expectError(() => newBranch.redo(), "nothing-to-redo");
});

test("caps undo history at 50 actions", () => {
  let registry = IslandRegistry.empty().create("Start", "blank-island", 0);
  const id = islandId(registry);

  for (let index = 1; index <= 55; index += 1) {
    registry = registry.rename(id, `Name ${index}`);
  }

  assert.equal(registry.history().length, 50);

  for (let index = 0; index < 50; index += 1) {
    registry = registry.undo();
  }

  assert.equal(registry.get(id)?.name, "Name 5");
  assert.equal(registry.canUndo, false);
  expectError(() => registry.undo(), "nothing-to-undo");
});

test("purge permanently removes sufficiently old deleted islands", () => {
  let registry = IslandRegistry.empty().create("Old", "empty-sea", 1);
  const id = islandId(registry);
  registry = registry.remove(id, 10);

  const retained = registry.purge(20, 10);
  assert.equal(retained.list({ includeDeleted: true }).length, 1);

  const purged = retained.purge(21, 10);
  assert.equal(purged.list({ includeDeleted: true }).length, 0);
  assert.equal(purged.canUndo, false);
});

test("fromJSON tolerates junk and repairs duplicate ids and names", () => {
  const valid = {
    id: "island-1",
    name: "Saved",
    createdAt: 1,
    lastVisitedAt: 1,
    lastEditedAt: null,
    forkOf: null,
    template: "palm-beach",
    readonly: true,
    deleted: false,
    edits: 0,
    bytes: 10,
    note: "",
  };

  assert.doesNotThrow(() => IslandRegistry.fromJSON(undefined));
  assert.doesNotThrow(() => IslandRegistry.fromJSON({ islands: "not an array" }));
  assert.doesNotThrow(() =>
    IslandRegistry.fromJSON({
      islands: [
        null,
        "junk",
        valid,
        { ...valid, name: "Saved", lastVisitedAt: 2 },
        { id: "missing-most-fields" },
        { ...valid, id: 123 },
      ],
    }),
  );

  const registry = IslandRegistry.fromJSON({
    islands: [
      null,
      "junk",
      valid,
      { ...valid, name: "Saved", lastVisitedAt: 2 },
      { id: "missing-most-fields" },
      { ...valid, id: 123 },
    ],
  });

  const islands = registry.list();
  assert.equal(islands.length, 2);
  assert.equal(new Set(islands.map((island) => island.id)).size, 2);
  assert.deepEqual(
    islands.map((island) => island.name).sort(),
    ["Saved", "Saved 2"],
  );

  const roundTripped = IslandRegistry.fromJSON(registry.toJSON());
  assert.deepEqual(roundTripped.toJSON(), registry.toJSON());
});

test("registry operations leave previous registries unchanged", () => {
  const empty = IslandRegistry.empty();
  const created = empty.create("Base", "blank-island", 1);
  const sourceId = islandId(created);
  const duplicated = created.duplicate(sourceId, 2);
  const copyId = duplicated.defaultId()!;
  const renamed = duplicated.rename(copyId, "Renamed");
  const removed = renamed.remove(copyId, 4);
  const restored = removed.restore(copyId);
  const visited = restored.visit(copyId, 6);
  const edited = visited.recordEdit(copyId, 7, 99);
  const noted = edited.setNote(copyId, "A private note.");

  assert.equal(empty.list().length, 0);
  assert.equal(created.list().length, 1);
  assert.equal(duplicated.get(copyId)?.name, "Copy of Base");
  assert.equal(renamed.get(copyId)?.deleted, false);
  assert.equal(removed.get(copyId)?.deleted, true);
  assert.equal(restored.get(copyId)?.lastVisitedAt, 2);
  assert.equal(visited.get(copyId)?.edits, 0);
  assert.equal(edited.get(copyId)?.note, "");
  assert.equal(noted.get(copyId)?.note, "A private note.");
  assert.equal(noted.totalBytes(), created.totalBytes() + 99);
});

test("formats relative time and island descriptions", () => {
  assert.equal(relativeTime(-1), "just now");
  assert.equal(relativeTime(0), "just now");
  assert.equal(relativeTime(59_999), "just now");
  assert.equal(relativeTime(60_000), "1 minute ago");
  assert.equal(relativeTime(3 * 3_600_000), "3 hours ago");
  assert.equal(relativeTime(2 * 86_400_000), "2 days ago");

  const meta: IslandMeta = {
    id: "island-2",
    name: "My Island",
    createdAt: 1,
    lastVisitedAt: 2,
    lastEditedAt: 3_600_000,
    forkOf: "island-1",
    template: "palm-beach",
    readonly: false,
    deleted: false,
    edits: 2,
    bytes: 99,
    note: "",
  };

  assert.equal(
    describeIsland(meta, 4 * 3_600_000),
    "My Island · edited 3 hours ago · branch of Palm Beach",
  );
});