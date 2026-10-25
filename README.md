# Agentia Org Memory

**Agentia remembers what your org already learned.**

An Agentia CLI plugin that gives Salesforce DevOps an organizational memory. Instead of treating every change as new, it learns from past deployments, failures, incidents, fixes and metadata changes, then uses that knowledge to judge the next change.

Demo video: _add link_ · Slides: _add link_

## The learning loop

| Stage | Command | What it does |
| --- | --- | --- |
| Capture | `agentia orgmemory capture` | Collects history from a JSON file, git, and Copado user stories |
| Learn | `agentia orgmemory learn` | Finds recurring patterns between kinds of changes and their outcomes |
| Analyze | `agentia orgmemory analyze` | Compares a new change with similar past changes |
| Predict | `agentia orgmemory predict` | Risk level with evidence, confidence and an optional Copado AI briefing (`--ai`) |
| Recommend | `agentia orgmemory recommend` | Tests, reviews and actions based on what failed and what fixed it before |
| Learn again | `agentia orgmemory feedback` | Feeds the real outcome back; patterns are relearned and the same change is re-scored |

Also: `init`, `doctor`, `report`.

## What it learns from

Every change is broken into features: the exact component, the Salesforce object, the metadata type, types that change together, and two "missing companion" rules that cause many real failures (Apex without a test class, a custom field without a PermissionSet or Profile). Each feature gets a failure rate with the evidence behind it. Risk is a transparent blend of those rates, weighted by how much evidence exists. No black box: every prediction lists the past changes it is based on.

## Install

```bash
npm install
npm run build
agentia plugins link .
agentia orgmemory --help
```

No Agentia CLI yet? `./bin/run.js orgmemory --help` runs the same commands standalone.

## Try it

```bash
cd <your Copado pipeline project>
agentia orgmemory init
agentia orgmemory capture --seed <path-to-plugin>/demo/seed-history.json
agentia orgmemory learn
agentia orgmemory predict --components "CustomField:Opportunity.Discount_Tier__c,ValidationRule:Opportunity.Discount_Tier_Check,ApexClass:OpportunityPricingService" --name US-DEMO-1
agentia orgmemory feedback --change US-DEMO-1 --outcome failed --env UAT --category permission --message "FLS missing" --fix "Added PermissionSet in same story"
agentia orgmemory report
```

## How it uses Copado

- `agentia cicd work list` imports user stories (`capture --copado`); components are linked through git commits that mention the story.
- Story names work everywhere: `predict --story US-0000012`.
- `agentia ai agent ask --agent release` turns the evidence into a short briefing (`predict --ai`).
- `--json` on every command, plus `SKILL.md`, so AI agents can run the loop headless.
- Memory is a plain JSON file (`.orgmemory/memory.json`). Commit it and the whole team shares one memory.

## Tested with

_Fill in: agentia --version, Node version, OS._

## Tests

`npm test`

## License

MIT
