# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`AGENTS.md`** at the repo root — the primary domain guide with project structure, conventions, key domain functions, and environment setup.
- **`docs/adrs/`** — read ADRs that touch the area you're about to work in.

If these files don't exist, proceed silently. Don't flag their absence.

If the project is missing an AGENTS.md or has no docs/adrs/ directory, the agent should escalate to the user: "This project doesn't have domain docs configured yet. Should I create AGENTS.md and docs/adrs/ from scratch?"

## File structure

Single-context repo:

```
/
├── AGENTS.md
├── docs/
│   ├── adrs/
│   │   └── 001-layered-architecture-refactor.md
│   └── agents/
│       ├── issue-tracker.md
│       ├── triage-labels.md
│       └── domain.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in AGENTS.md. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't defined yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
