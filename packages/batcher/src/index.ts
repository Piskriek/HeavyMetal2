import * as THREE from 'three';

/**
 * A single drawable piece of one "kind of piece": one geometry drawn with one
 * material. Parts are owned by the caller, shared by every instance that uses
 * the same key, and are never disposed by the batcher.
 */
export interface Part {
    readonly geometry: THREE.BufferGeometry;
    readonly material: THREE.Material;
}

/**
 * Answers "which meshes make up this kind of piece?".
 * Called at most once per key - the first time that key is used.
 */
export type PartSource = (key: string) => readonly Part[];

/** Capacity of a freshly built batch. */
const INITIAL_CAPACITY = 16;

/**
 * Read-only scratch used to write "no tint" back into an `instanceColor`
 * buffer once one exists. Never written to.
 */
const WHITE = new THREE.Color(1, 1, 1);

/** Everything the batcher remembers about one live instance id. */
interface Entry {
    /** Key the instance currently belongs to. */
    key: string;
    /** Authoritative transform, mirrored into every batch of `batches`. */
    matrix: THREE.Matrix4;
    /** Per-instance colour, or `null` for plain white. */
    color: THREE.Color | null;
    /** The key's batches, one per part. */
    batches: readonly Batch[];
    /** Slot this instance occupies in `batches[part]`. */
    slots: number[];
}

/**
 * One `InstancedMesh`: the (key, part) pair every instance of a key is drawn
 * with. A batch keeps its live instances packed at the front of the buffer,
 * so `mesh.count` always equals the number of live instances.
 */
class Batch {
    /** `${key}#${part}` - see `mesh.name`. */
    readonly key: string;
    /** Index of the part inside the key's part list. */
    readonly part: number;
    /** Slot -> instance id. Only `count` entries are meaningful. */
    readonly ids: number[] = [];

    /** The (disposable, replaceable) instanced mesh doing the drawing. */
    mesh: THREE.InstancedMesh;
    /** Instances that fit in `mesh` before it has to be rebuilt. */
    capacity: number;
    /** Live instances, always equal to `mesh.count`. */
    count = 0;

    private readonly geometry: THREE.BufferGeometry;
    private readonly material: THREE.Material;
    private readonly root: THREE.Object3D;

    constructor(
        root: THREE.Object3D,
        key: string,
        part: number,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
    ) {
        this.root = root;
        this.key = key;
        this.part = part;
        this.geometry = geometry;
        this.material = material;
        this.capacity = INITIAL_CAPACITY;
        this.ids.length = INITIAL_CAPACITY;
        this.mesh = this.createMesh(INITIAL_CAPACITY);
        root.add(this.mesh);
    }

    /**
     * Puts one instance at the end of the buffer and returns its slot.
     * Grows (and rebuilds) the mesh first if the batch is full.
     */
    append(id: number, matrix: THREE.Matrix4, color: THREE.Color | null): number {
        if (this.count === this.capacity) this.grow();

        const mesh = this.mesh;
        const slot = this.count;

        mesh.setMatrixAt(slot, matrix);
        this.writeColor(slot, color);
        this.ids[slot] = id;

        this.count = slot + 1;
        mesh.count = this.count;
        mesh.visible = true;
        this.touch();

        return slot;
    }

    /**
     * Drops the instance in `slot` by swapping the last instance into the hole,
     * which keeps the buffer dense. `entries` is used to re-point the instance
     * that was moved.
     */
    removeSlot(slot: number, entries: Map<number, Entry>): void {
        const mesh = this.mesh;
        const last = this.count - 1;

        if (slot !== last) {
            (mesh.instanceMatrix.array as Float32Array).copyWithin(
                slot * 16,
                last * 16,
                last * 16 + 16,
            );

            const colors = mesh.instanceColor;
            if (colors !== null) {
                (colors.array as Float32Array).copyWithin(slot * 3, last * 3, last * 3 + 3);
            }

            const moved = this.ids[last]!;
            this.ids[slot] = moved;

            const entry = entries.get(moved);
            if (entry !== undefined) entry.slots[this.part] = slot;
        }

        this.count = last;
        mesh.count = last;
        mesh.visible = last > 0;
        this.touch();
    }

    /** Overwrites the transform of an instance that stays where it is. */
    writeMatrix(slot: number, matrix: THREE.Matrix4): void {
        this.mesh.setMatrixAt(slot, matrix);
        this.mesh.instanceMatrix.needsUpdate = true;
        this.invalidateBounds();
    }

    /**
     * Overwrites the colour of an instance that stays where it is. A `null`
     * colour only writes when a colour buffer exists (it defaults to white).
     */
    writeColor(slot: number, color: THREE.Color | null): void {
        const mesh = this.mesh;
        const colors = mesh.instanceColor;

        if (color === null) {
            if (colors === null) return;
            mesh.setColorAt(slot, WHITE);
        } else {
            mesh.setColorAt(slot, color);
        }

        const attribute = mesh.instanceColor;
        if (attribute !== null) attribute.needsUpdate = true;
    }

    /** Detaches the mesh from the scene graph and frees its instance buffers. */
    dispose(): void {
        this.mesh.removeFromParent();
        this.mesh.dispose();
        this.mesh.visible = false;
        this.count = 0;
        this.mesh.count = 0;
        this.ids.length = 0;
    }

    /**
     * Rebuilds the mesh with twice the capacity, copying every live matrix and
     * tint over. The shared geometry and material are left alone.
     */
    private grow(): void {
        const previous = this.mesh;
        const capacity = this.capacity * 2;
        const mesh = this.createMesh(capacity);

        (mesh.instanceMatrix.array as Float32Array).set(
            (previous.instanceMatrix.array as Float32Array).subarray(0, this.count * 16),
        );

        const colors = previous.instanceColor;
        if (colors !== null) {
            const array = new Float32Array(capacity * 3).fill(1);
            array.set((colors.array as Float32Array).subarray(0, this.count * 3));
            const attribute = new THREE.InstancedBufferAttribute(array, 3);
            attribute.setUsage(THREE.DynamicDrawUsage);
            mesh.instanceColor = attribute;
        }

        this.ids.length = capacity;
        this.replace(previous, mesh);
        previous.dispose();

        this.mesh = mesh;
        this.capacity = capacity;
    }

    private createMesh(capacity: number): THREE.InstancedMesh {
        const mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
        mesh.name = `${this.key}#${this.part}`;
        // Instances carry their whole transform, so the batch itself never moves.
        mesh.matrixAutoUpdate = false;
        // Still pick up the root's transform on the first world matrix update.
        mesh.matrixWorldNeedsUpdate = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.count = this.count;
        return mesh;
    }

    /**
     * Swaps `mesh` in where `previous` sat, so a rebuild does not reshuffle
     * the draw order inside the root.
     */
    private replace(previous: THREE.InstancedMesh, mesh: THREE.InstancedMesh): void {
        const parent = previous.parent;
        const index = parent === null ? -1 : parent.children.indexOf(previous);

        if (parent === null || index < 0) {
            this.root.add(mesh);
            return;
        }

        parent.children[index] = mesh;
        mesh.parent = parent;
        previous.parent = null;
    }

    /** Flags the instance buffers for upload and the bounds for recompute. */
    private touch(): void {
        const mesh = this.mesh;
        mesh.instanceMatrix.needsUpdate = true;
        const colors = mesh.instanceColor;
        if (colors !== null) colors.needsUpdate = true;
        this.invalidateBounds();
    }

    /**
     * Bounding volumes are recomputed by three itself, lazily, the next time
     * they are needed (frustum culling or raycasting) - so they always cover
     * exactly the live instances and we never pay for untouched batches.
     */
    private invalidateBounds(): void {
        this.mesh.boundingSphere = null;
        this.mesh.boundingBox = null;
    }
}

/**
 * Draws hundreds of copies of a handful of building pieces with one
 * `InstancedMesh` per (key, part) instead of one draw call per mesh.
 *
 * Draw calls become `sum over the keys in use of their part count`, no matter
 * how many instances there are, and every batch stays dense so no instance
 * slot is ever wasted.
 */
export class Batcher {
    private readonly root: THREE.Object3D;
    private readonly source: PartSource;

    /** Live instances by id. */
    private readonly entries = new Map<number, Entry>();
    /** Memoizes `source`, which is called once per key. */
    private readonly parts = new Map<string, readonly Part[]>();
    /** One batch list per key, one batch per part. */
    private readonly batches = new Map<string, Batch[]>();

    private liveInstances = 0;
    private liveBatches = 0;

    constructor(root: THREE.Object3D, source: PartSource) {
        this.root = root;
        this.source = source;
    }

    /** `InstancedMesh`es in the root with `count > 0`. */
    get drawCalls(): number {
        return this.liveBatches;
    }

    /** Number of live instances, across every key. */
    get instances(): number {
        return this.liveInstances;
    }

    /**
     * Adds, moves or re-keys one instance. Calling this again for a live id
     * with the same key only rewrites its matrices; with a different key the
     * instance is moved into that key's batches, keeping its tint.
     */
    set(id: number, key: string, matrix: THREE.Matrix4): void {
        let entry = this.entries.get(id);

        if (entry !== undefined && entry.key === key) {
            entry.matrix.copy(matrix);
            for (let part = 0; part < entry.batches.length; part++) {
                entry.batches[part]!.writeMatrix(entry.slots[part]!, entry.matrix);
            }
            return;
        }

        if (entry === undefined) {
            entry = { key: '', matrix: new THREE.Matrix4(), color: null, batches: [], slots: [] };
            this.entries.set(id, entry);
            this.liveInstances++;
        } else {
            this.detach(entry);
        }

        this.attach(id, entry, key, matrix);
    }

    /** Drops one instance. Unknown ids are ignored. */
    remove(id: number): void {
        const entry = this.entries.get(id);
        if (entry === undefined) return;

        this.entries.delete(id);
        this.detach(entry);
        this.liveInstances--;
    }

    /**
     * Sets the per-instance colour of one instance, or clears it with `null`.
     * The tint follows the instance through moves, re-keys and swaps.
     */
    tint(id: number, color: THREE.Color | null): void {
        const entry = this.entries.get(id);
        if (entry === undefined) return;

        if (color === null) {
            if (entry.color === null) return;
            entry.color = null;
        } else {
            if (entry.color === null) entry.color = new THREE.Color();
            entry.color.copy(color);
        }

        for (let part = 0; part < entry.batches.length; part++) {
            entry.batches[part]!.writeColor(entry.slots[part]!, entry.color);
        }
    }

    /** Whether `id` is currently drawn. */
    has(id: number): boolean {
        return this.entries.has(id);
    }

    /**
     * The transform of `id`, or `null` when it is not live.
     * The returned matrix is owned by the batcher: copy it before keeping it.
     */
    matrixOf(id: number): THREE.Matrix4 | null {
        const entry = this.entries.get(id);
        return entry === undefined ? null : entry.matrix;
    }

    /**
     * Removes every batch from the root and disposes their instance buffers.
     * The shared geometries and materials are not touched, and the batcher can
     * be used again afterwards (its parts source will be asked for once more).
     */
    dispose(): void {
        for (const list of this.batches.values()) {
            for (const batch of list) batch.dispose();
        }
        this.batches.clear();
        this.parts.clear();
        this.entries.clear();
        this.liveInstances = 0;
        this.liveBatches = 0;
    }

    /** Puts an entry into every batch of `key`, keeping its tint. */
    private attach(id: number, entry: Entry, key: string, matrix: THREE.Matrix4): void {
        const batches = this.batchesFor(key);

        entry.key = key;
        entry.matrix.copy(matrix);
        entry.batches = batches;

        if (entry.slots.length !== batches.length) {
            entry.slots.length = batches.length;
            entry.slots.fill(-1);
        }

        for (let part = 0; part < batches.length; part++) {
            const batch = batches[part]!;
            entry.slots[part] = batch.append(id, entry.matrix, entry.color);
            if (batch.count === 1) this.liveBatches++;
        }
    }

    /** Takes an entry out of its batches, filling the holes it leaves. */
    private detach(entry: Entry): void {
        const batches = entry.batches;

        for (let part = 0; part < batches.length; part++) {
            const batch = batches[part]!;
            batch.removeSlot(entry.slots[part]!, this.entries);
            if (batch.count === 0) this.liveBatches--;
        }

        entry.batches = [];
        entry.slots.length = 0;
    }

    /** The batch list of a key, building it (and asking for the parts) once. */
    private batchesFor(key: string): Batch[] {
        let list = this.batches.get(key);

        if (list === undefined) {
            const parts = this.partsFor(key);
            list = [];
            for (let part = 0; part < parts.length; part++) {
                const source = parts[part]!;
                list.push(
                    new Batch(
                        this.root,
                        key,
                        part,
                        source.geometry,
                        source.material,
                    ),
                );
            }
            this.batches.set(key, list);
        }

        return list;
    }

    private partsFor(key: string): readonly Part[] {
        let parts = this.parts.get(key);
        if (parts === undefined) {
            parts = this.source(key);
            this.parts.set(key, parts);
        }
        return parts;
    }
}
