# Contract: Diagram JSON

The canonical, round-trippable diagram format. This is the product's stable
center (constitution V): every other export is a projection of it, and it is
the format users share, version, and store.

## Shape

See [data-model.md](../data-model.md) — the `Diagram` entity is the contract.
Formatted with `JSON.stringify(…, null, 2)`.

## Guarantees

1. **Round-trip**: importing an exported JSON reproduces the same diagram —
   positions, labels, images, node kinds, edge variants, manual sizes.
   Untouched nodes carry no `width`/`height` and keep auto-sizing on import.
2. **Self-contained**: node images are base64 `data:` URIs. A JSON file is a
   single portable artifact; no field may reference the local filesystem,
   blob/object URLs, or the network.
3. **Backward compatible**: fields added in the future must be optional with
   defined absent-behavior; existing JSON keeps importing (constitution,
   Additional Constraints).
4. **No runtime leakage**: React Flow internal/runtime fields (selection,
   measured dimensions, handles) are stripped on export.

## Consumers

- The editor itself (paste-back / re-import).
- The agent bundle (ships as `diagram.json`).
- Human diffing/versioning (stable key order: nodes then edges; per-node key
  order as emitted by `serializeDiagram`).
