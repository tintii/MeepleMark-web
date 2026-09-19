# Golden corpus

Language-neutral pins on scoring-engine behaviour. Each file in `cases/` pairs
an input play document with the totals, ranks, win flags, and warnings any
correct engine implementation must produce for it — Swift today, and any
future reimplementation on another platform.

## Format

```json
{
  "id": "kebab-case-slug",
  "specScenario": "kebab-case-slug matching a '#### Scenario:' heading in specs/scoring-engine/spec.md",
  "description": "one line of prose",
  "input": { "...": "a full play document, per schemas/play.schema.json" },
  "expected": {
    "players": [
      { "name": "Alice", "total": "63" or null, "rank": 1 or null, "win": true/false/null }
    ],
    "warnings": [
      { "code": "rank-gap-unjustified", "playerNames": ["Bob"] }
    ]
  }
}
```

- `total` is a decimal string (or `null`), never a JSON number — same rule as the play document itself.
- `expected.players` must list every player in `input.players`, in the same order.
- `expected.warnings` must list every warning the engine produces, in any order. A case with no warnings uses `[]`.
- `warnings[].code` and `warnings[].playerNames` are checked; `message` text is not — prose may change without invalidating the corpus.
- `id` and `specScenario` are usually the same slug; `specScenario` is what the coverage check (`GoldenCoverageTests`) maps against the scenarios enumerated in `specs/scoring-engine/spec.md`.

## Versioning

`VERSION` carries an integer, bumped whenever a case is added, removed, or its expectations change. `GoldenVersionTests` asserts it's readable and non-empty. Any implementation's test suite reads every file under `cases/` and reproduces its `expected` block exactly — see `GoldenFileTests.swift` for the reference runner.

## Scope

Golden files pin `evaluate()` behaviour: totals, ranks, win flags, warnings. Schema and semantic *validation* (task 6.1) and the golden corpus's own coverage/versioning machinery are covered by their own test suites, not by golden cases — a golden file about "the coverage test covers everything" would be circular.
