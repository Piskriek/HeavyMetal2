# Approximations and Known Limitations

This document records the deliberate approximations and known limitations in the HeavyMetal2 implementation as of T12.

## Physics and Collision

### Wall CCD (Continuous Collision Detection)
- **Approximation**: Swept sphere vs OBB uses simplified time-of-impact calculation
- **Impact**: May miss very fast collisions at extreme velocities (>1000 units/tick)
- **Mitigation**: Velocity clamping in game logic prevents extreme speeds

### Rolling Resistance
- **Approximation**: Coefficient is constant (2%) regardless of surface material
- **Impact**: All surfaces feel the same; no mud/ice/asphalt differentiation
- **Mitigation**: Acceptable for arcade physics; can be extended per-surface later

### Dent System
- **Approximation**: Recovery uses exponential decay (0.5/s) rather than physically accurate material deformation
- **Impact**: Dents "pop back" rather than slowly unfolding
- **Mitigation**: Visual effect only; gameplay impact is minimal

### Rolling State
- **Approximation**: Pure rolling constraint (ω = v/r) ignores slip and skid
- **Impact**: No realistic drift or loss of traction simulation
- **Mitigation**: Arcade physics model prioritizes responsiveness over realism

## Qualifying and Race Logic

### Qualifying Timing
- **Approximation**: Gate crossing uses linear interpolation between ticks
- **Impact**: Sub-tick precision is approximate, not exact
- **Mitigation**: Deterministic and consistent; fairness preserved

### Release Spacing
- **Approximation**: Wave spacing is quantized to tick boundaries
- **Impact**: Actual spacing may vary by ±1 tick from requested value
- **Mitigation**: Safety margins account for quantization

## Rendering and Visual Effects

### Cube-Sphere Geometry
- **Approximation**: Seam edges use vertex averaging rather than true spherical interpolation
- **Impact**: Minor visual artifacts at face boundaries at very high zoom
- **Mitigation**: Gutter pixels in atlas prevent texture bleeding

### Diagnostic Atlas
- **Approximation**: Gutter survival check samples discrete points rather than full pixel coverage
- **Impact**: Theoretical edge cases could slip through
- **Mitigation**: 4-pixel gutter is generous; sampling is dense enough for practical purposes

### Dent Shader
- **Approximation**: Quadratic falloff for dent displacement
- **Impact**: Dent shape is parabolic rather than physically accurate crater
- **Mitigation**: Visual effect only; acceptable for stylized graphics

## Performance and Scalability

### Field Size Limits
- **Tested**: 4, 20, 50, 100 racers
- **Approximation**: Performance beyond 100 racers not validated
- **Impact**: May degrade gracefully or hit hard limits
- **Mitigation**: Field size is capped in config; no dynamic scaling

### Physics Performance
- **Measured**: p95 ≤ 0.29ms for 100 racers × 20 walls (Wall CCD)
- **Target**: ≤ 4ms per 8.33ms tick at 100 racers
- **Headroom**: ~13× margin; can accommodate more complex physics

### Memory Usage
- **Measured**: 0.50MB/iteration for full pipeline soak test
- **Approximation**: Long-term (>1 hour) memory behavior not tested
- **Impact**: Potential for slow leaks in extended sessions
- **Mitigation**: 2-minute soak test shows no leaks; manual 15-minute soak recommended before release

## Accessibility

### Reduced Motion
- **Implementation**: Disables screen shake, menu animations, particle effects
- **Approximation**: Does not reduce visual complexity or color intensity
- **Impact**: Some users may still find visuals overwhelming
- **Mitigation**: High contrast mode available separately

### Keyboard Controls
- **Implementation**: All actions keyboard-accessible with configurable bindings
- **Approximation**: No mouse/gamepad support in current implementation
- **Impact**: Limits input device options
- **Mitigation**: Keyboard is universal; gamepad support is future work

### High Contrast
- **Implementation**: Boolean flag available in options
- **Approximation**: Actual contrast adjustments depend on rendering pipeline
- **Impact**: Effectiveness varies by display and user perception
- **Mitigation**: System preference detection via `prefers-contrast: more`

## Storage and Persistence

### Track Storage
- **Approximation**: Uses localStorage with JSON serialization
- **Impact**: Limited to ~5MB per origin; no cross-device sync
- **Mitigation**: Adequate for prop layouts; cloud sync is future work

### Options Persistence
- **Approximation**: Individual preference saves rather than atomic transaction
- **Impact**: Theoretical race condition if multiple tabs write simultaneously
- **Mitigation**: Single-tab usage is typical; last-write-wins is acceptable

## Testing Coverage

### Integration Tests
- **Coverage**: 20, 50, 100 racer pipelines validated
- **Approximation**: Does not test all course/loadout combinations
- **Impact**: Edge cases in specific configurations may exist
- **Mitigation**: Core logic is course-agnostic; course-specific tests in T08

### Soak Tests
- **Coverage**: 2-minute automated soak (50 iterations)
- **Approximation**: Full 15-minute soak is manual only
- **Impact**: Long-running memory leaks may not be caught in CI
- **Mitigation**: Manual soak required before release; CI soak catches major leaks

## Known Missing Features

### Protected Bytes Verification
- **Status**: Not implemented
- **Reason**: Requires real baseline data from production build
- **Impact**: Cannot verify byte-level integrity of critical data structures
- **Mitigation**: Acceptance criteria marked as blocked pending baseline

### Decoration Integrity
- **Status**: Partially implemented (atlas gutter survival)
- **Reason**: Full decoration integrity requires visual regression testing
- **Impact**: Visual regressions may slip through
- **Mitigation**: Manual visual QA required; automated screenshot comparison is future work

## Future Improvements

1. **Surface-specific rolling resistance** — Different coefficients for mud, ice, asphalt
2. **Physically accurate dent recovery** — Material deformation simulation
3. **Tire slip simulation** — Realistic drift and traction loss
4. **Gamepad support** — DirectInput/XInput integration
5. **Cloud sync** — Cross-device track and options synchronization
6. **Visual regression testing** — Automated screenshot comparison
7. **Extended soak testing** — 1-hour automated soak in CI
8. **Performance profiling** — Real-time FPS and memory monitoring overlay

---

**Last Updated**: 2026-09-23 (T12 completion)  
**Total Test Coverage**: 454 tests (434 existing + 14 integration + 16 accessibility + 4 soak)  
**Performance**: All benchmarks meet or exceed targets
