# Quickstart: Feature 009 Validation

This quickstart validates engine-side Kafka behavior only (no new UI controls in this feature).

## Prerequisites

- Node dependencies installed
- Working directory: repository root

## 1. Run deterministic engine tests

```powershell
npm test
```

Expected:
- Existing engine tests remain green.
- Kafka-specific tests pass for:
  - Network saturation wall
  - CPU saturation wall with TLS/zstd effect
  - Disk saturation wall
  - Disk Cliff transition to degraded regime

## 2. Validate compile/build compatibility

```powershell
npm run build
```

Expected:
- TypeScript build succeeds with extended port contracts.
- No UI regression compile errors from expanded `SimRole` union.

## 3. Manual compatibility smoke check (optional)

1. Start app (`npm run dev`).
2. Load existing 008-like topology JSON.
3. Ensure app loads without schema/runtime errors.
4. Confirm simulation start/pause/reset remains functional for legacy roles.

## 4. Formula traceability contract spot-check

From emitted metrics window data for a Kafka node, verify:

- `formulaDescriptors` exists.
- Each descriptor has non-empty `sources`.
- Binding formula flag (`isBinding`) matches active wall/regime.

## 5. Determinism check

Run the same seeded scenario twice and compare final Kafka metrics window:

- Throughput/lag/saturation values match exactly (or within deterministic floating precision expectations if asserted with tolerance).
