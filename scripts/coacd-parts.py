# Labels each face of a fused generated model with a part id, for `lod-bake.py --parts` (TICKET-29, docs/argo/plans/37).
#   python scripts/coacd-parts.py <norm.glb> <parts.json> [--threshold=0.08] [--max-hulls=24] [--min-part=0.02] [--preview=<out.glb>]
# Generated models are one fused skin (a single 40k-triangle island), so the gaps between a machine's parts are smooth
# webbed fillets and no edge angle marks them. CoACD (MIT, https://github.com/SarahWeiii/CoACD) cuts a mesh into
# near-convex pieces where it is concave by volume, which on a hard-surface machine is where one part meets the next.
# Each face then takes the hull it lies nearest (for a convex hull, the largest plane distance is a cheap signed
# distance), parts smaller than --min-part of the surface fold into their nearest big neighbour, and two majority
# passes over face neighbours clean the jagged borders. --threshold is CoACD's concavity limit (lower = more parts).
# Output: {centroids: [x,y,z,...] in glTF axes, labels: [...]} for lod-bake.py, plus a few stats; --preview writes the
# mesh with one colour per part for review. Deterministic: CoACD runs with a fixed seed.
# Needs coacd, trimesh, numpy (and scipy for --preview): on the 3D PC they live in the venv E:\AI\coacd\venv (CPU only,
# kept apart from the Hunyuan pipeline). A 40k-triangle machine takes 1.5 to 6 minutes there.
import json
import sys

import coacd
import numpy as np
import trimesh

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
src, out = args[0], args[1]
threshold = float(opt.get('threshold', 0.08))
max_hulls = int(opt.get('max-hulls', 24))
min_part = float(opt.get('min-part', 0.02))

mesh = trimesh.load(src, force='mesh', process=False)
faces = np.asarray(mesh.faces)
centroids = np.asarray(mesh.triangles_center)
areas = np.asarray(mesh.area_faces)

coacd.set_log_level('error')
hulls = coacd.run_coacd(coacd.Mesh(np.asarray(mesh.vertices), faces), threshold=threshold,
                        max_convex_hull=max_hulls, preprocess_mode='auto', seed=0)


def plane_distance(hull, pts):
    """The largest signed distance from `pts` to the hull's face planes: <= 0 inside, about the distance outside."""
    h = trimesh.Trimesh(vertices=hull[0], faces=hull[1], process=True)
    n = np.asarray(h.face_normals)
    d = np.einsum('ij,ij->i', n, np.asarray(h.triangles)[:, 0, :])
    best = np.full(len(pts), -np.inf)
    for s in range(0, len(n), 256):
        best = np.maximum(best, (pts @ n[s:s + 256].T - d[s:s + 256]).max(axis=1))
    return best


dist = np.stack([plane_distance(h, centroids) for h in hulls], axis=1)  # faces x hulls
labels = dist.argmin(axis=1)

# fold the slivers: a part under min_part of the surface hands its faces to their nearest big hull
total = areas.sum()
while True:
    share = np.bincount(labels, weights=areas, minlength=len(hulls)) / total
    small = [k for k in np.unique(labels) if share[k] < min_part]
    big = [k for k in np.unique(labels) if share[k] >= min_part]
    if not small or not big:
        break
    for k in small:
        idx = labels == k
        labels[idx] = np.array(big)[dist[idx][:, big].argmin(axis=1)]

# two majority passes: a face whose neighbours mostly carry another label takes it (jagged borders, stray faces)
adj = mesh.face_adjacency
for _ in range(2):
    votes = {}
    for a, b in adj:
        votes.setdefault(a, []).append(labels[b])
        votes.setdefault(b, []).append(labels[a])
    nxt = labels.copy()
    for f, v in votes.items():
        vals, counts = np.unique(v, return_counts=True)
        if counts.max() >= 2 and vals[counts.argmax()] != labels[f]:
            nxt[f] = vals[counts.argmax()]
    labels = nxt

ids = {k: i for i, k in enumerate(np.unique(labels))}
labels = np.array([ids[k] for k in labels])
share = np.bincount(labels, weights=areas) / total
with open(out, 'w') as fh:
    json.dump({'centroids': [round(float(c), 5) for c in centroids.ravel()], 'labels': labels.tolist(),
               'hulls': len(hulls), 'parts': len(ids), 'threshold': threshold,
               'share': [round(float(s), 4) for s in share]}, fh)
print(f'{src}: {len(faces)} faces, {len(hulls)} hulls -> {len(ids)} parts '
      f'(shares {", ".join(f"{s:.0%}" for s in sorted(share, reverse=True))})')

if 'preview' in opt:
    rng = np.random.default_rng(7)
    palette = rng.integers(40, 255, size=(len(ids), 3))
    colours = np.concatenate([palette[labels], np.full((len(labels), 1), 255)], axis=1).astype(np.uint8)
    trimesh.Trimesh(vertices=mesh.vertices, faces=faces, face_colors=colours, process=False).export(opt['preview'])
