---
name: agentia-orgmemory
description: Use before promoting a Salesforce change through a Copado pipeline. Predicts deployment risk from the org's own history, explains the evidence, recommends actions, and records the real outcome afterwards.
---

# Org Memory for Copado Agentia

Org Memory remembers what happened to past Salesforce changes in this org (failures, fixes, incidents) and uses it to judge new changes.

## When to use
- A developer is about to commit, promote or release a change and asks "is this risky?" or "what should I test?".
- A release has just finished (success or failure) and the outcome should be remembered.

## Workflow
1. Check setup: `agentia orgmemory doctor`
2. Judge the change (on the feature branch, or name a story/components):
   `agentia orgmemory predict --json`
   `agentia orgmemory predict --story US-0000012 --json`
   `agentia orgmemory predict --components "CustomField:Opportunity.Discount_Tier__c,ApexClass:PricingService" --name US-123 --json`
3. Read `risk.level`, `evidence` (what failed before, with record ids) and `recommendations`. Explain them to the developer in plain language. Never invent evidence that is not in the output.
4. If `risk.level` is HIGH, recommend the listed actions and ask the developer before promoting. Do not promote to production on your own.
5. After the release, record what really happened:
   `agentia orgmemory feedback --change US-123 --outcome failed --env UAT --category permission --message "..." --fix "..."`
   Use `--outcome success` when it went well. This is what makes the next prediction better.

## Other commands
- `agentia orgmemory capture --seed <file> | --git | --copado` collects history
- `agentia orgmemory learn` shows the strongest risk patterns
- `agentia orgmemory analyze` / `recommend` show only the similar changes or only the actions
- `agentia orgmemory report --out report.md` summarises what the org has learned

## Rules
- Predictions are decision support, not a gate. Confidence below 40% means the history is thin; say so.
- Always pass `--json` when you need to parse the result.
