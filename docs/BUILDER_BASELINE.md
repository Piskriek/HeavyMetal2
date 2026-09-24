# Heavy Metal GP 2 — Builder Performance Baseline

Recorded: 2026-09-24T17:38:58.520Z

## Bundle Size Baseline
- **Raw Bundle**: 1608.58 kB
- **Gzip Bundle**: 442.95 kB
- **Budget Threshold**: ≤ 522.95 kB gzip (+80 kB budget)

## Baseline Dense Scene (dense-500.json)
- Props: 500
- Course: Ridge
- Unbatched Draw Calls: ~660 (including shadow maps & decals)
- Batched Target: ≤ 30% of unbatched draw calls
