# Architecture

```
git history ─┐
seed JSON   ─┼─> capture ─> memory.json (records) ─> learn ─> patterns
Copado work ─┘                                              │
                                                            v
 feature branch / story / components ─> resolve ─> assess (similarity + patterns) ─> risk, evidence, actions
                                                            │
                          Copado AI agent (optional) <──────┤
                                                            v
                         release outcome ─> feedback ─> record + relearn ─> better next prediction
```

- `src/lib/components.ts` turns source-format paths into Salesforce components.
- `src/lib/learn.ts` derives features and learns failure rates (smoothed toward the org baseline).
- `src/lib/assess.ts` matches a new change to patterns, finds similar past changes, scores risk and builds recommendations.
- `src/lib/agentia.ts` is the only place that calls the Agentia CLI (`cicd work list`, `ai agent ask`).
- Commands live in `src/commands/orgmemory/`.

Risk score: strength = smoothed failure rate x (n / (n + 4)). Score blends the strongest signal with the combined top three. Confidence grows with evidence count and similarity to past changes.
