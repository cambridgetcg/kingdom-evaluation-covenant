# Repository instructions

These instructions apply to the whole repository.

## Contract

Preserve `KINGDOM Evaluation Covenant v0.1` as a deterministic, zero-dependency, offline, read-only Phase-0 producer. The only permitted generated write is the exact fixed path `public/evaluation-covenants.json` through the atomic writer in `src/io.mjs`.

Global and per-design states must remain `DRAFT`, `UNSEALED`, `UNREGISTERED`, `NO-RUN`, `NO-RESULT`, `NOT-APPROVED`, with adoption and use-authority effects `NONE`. Never add live data, participants, personal records, results, estimates, amounts, thresholds, option selection, rankings, recommendations, action surfaces, tools, runners, forms, accounts, POST behavior, runtime fetches, LLM calls, MCP exposure, deployment, or external effects.

## Frozen inputs

Do not silently rotate any input, vendor, schema, design, dossier, proposition, or public receipt. A legitimate byte change requires explicit maintainer direction, a complete receipt rotation, regenerated schema and public artifact, full adversarial tests, independent review, and a new release decision.

Official source URLs are method/governance orientation only. Do not fetch or retain source bodies. Do not infer exact-text review, currency, legal effect, endorsement, licence, reuse rights, empirical evidence, estimand values, results, or authority from links.

The Reality Influence map and J-space are not imported, bound, projected, evidence, lineage, design authority, or public related resources. Trial Chamber fields are forbidden except for the exact negative separation inventory.

## Editing and verification

- Use Node.js built-ins only; keep `dependencies` and `devDependencies` absent.
- Keep one closed Draft 2020-12 public schema; every object is closed and every declared property required.
- Preserve fatal UTF-8 decoding, duplicate-key rejection, safe integer and structural bounds, symlink rejection, null-prototype canonicalisation, prototype-key injectivity, exact receipts, full-output personal-shape scanning, and atomic write/rename behavior.
- Do not weaken semantic cross-field checks in favor of schema-only checks.
- Do not initialise Git, publish, tag, release, deploy, or message external systems without explicit maintainer authorization.

Before presenting any candidate as final, run:

```sh
npm test
npm run validate
npm run build
npm run build:check
npm run check
npm run overview
```

Then verify the build is deterministic, no symlink exists, no undeclared file is present, and no working file outside this repository was changed.
