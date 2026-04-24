# SFMC Migration Toolkit Backlog

Last audited: **2026-04-24**

This file now tracks task status explicitly:
- ✅ **Done**
- 🟡 **In progress / partially done**
- ⬜ **Not started**

## P0 — Spec integrity

1. ✅ **Define missing Journey lifecycle schemas** — Present in `components.schemas` (`JourneyPauseRequest`, `JourneyResumeRequest`, `JourneyStopRequest`, `JourneyLifecycleRequest`, `JourneyLifecycleResponse`, contact membership schemas).
2. ✅ **Fix `/v2/authorize` method and shape** — Modeled as `GET` with query params and `302` redirect semantics.
3. ✅ **Align declared oauth2 scopes with operation usage** — Scope sync check exists and now fails on both missing and unused declarations (`npm run check:scopes`).
4. ✅ **Resolve duplicate `/messaging/v1/email/messages` paths** — Canonicalized path in root and fragment.
5. ✅ **Fix malformed `x-original-marketing-cloud-paths`** — Leading slash normalization complete.
6. ✅ **Make the spec validate cleanly** — `swagger-cli validate` + Spectral + scope/migration checks are in `npm run validate` and CI.

## P1 — Cross-cutting architecture

7. ⬜ **Scope the auth host per operation** — Auth/discovery server scoping still needs explicit operation-level overrides (or a split auth spec).
8. ⬜ **Add a root-level default `security:`** — Root-level `security:` default is still missing; auth/discovery routes already use `security: []`.
9. 🟡 **Introduce shared error schemas and reusable responses** — Some families use shared responses; rollout to every operation remains incomplete.
10. 🟡 **Codify `additionalProperties` policy** — Many schemas conform; full repo-wide sweep still pending.
11. 🟡 **Mark legacy routes deprecated** — Several legacy routes are flagged, but not all superseded variants are consistently marked.
12. ⬜ **Add reusable paging parameters** — Not yet fully centralized and applied across all collection GETs.

## P2 — Replace fallback schemas with typed models

13. 🟡 Transactional Email (typed coverage improved; full 15-fallback elimination still pending).
14. ⬜ Transactional SMS typing + canonical base-path consolidation.
15. ⬜ Contacts typing sweep (largest remaining cluster).
16. ⬜ Content Builder typing/discriminator/query body completion.
17. ⬜ Mobile Push typing completion.
18. ⬜ Event Notification Service typing completion.
19. ⬜ Tags typing/trailing-slash normalization completion.
20. ⬜ Data Extensions async rows/results/status typing completion.
21. ⬜ Campaigns typing + paging/scope confirmation completion.
22. ⬜ Approvals typing completion.
23. ⬜ MobileConnect SMS typing + deprecation normalization completion.
24. 🟡 Journey Builder typing (lifecycle done; remaining generic endpoints pending).
25. ⬜ Domain Verification typing completion.
26. ⬜ Address Validation typing completion.
27. ⬜ Audit Logging envelope typing completion.

## P3 — Examples, tooling, hygiene

28. ⬜ Back-fill examples for every write/polling flow.
29. ✅ **Validation tooling and CI gate** — Implemented via `npm run validate`, Spectral, swagger-cli, and GitHub Action.
30. ✅ **Add bundling step** — `npm run bundle:openapi` emits `dist/sfmc.yaml`; included in `npm run validate`.
31. ⬜ Pilot a codegen run and document manual fixes.
32. ✅ **Fix README file references** — Repo paths now match actual file layout.
33. ✅ **Add `CHANGELOG.md`** — Added and seeded with current milestone entry.
34. ✅ **Sweep unused declared scopes** — `openid` removed from oauth2 declarations; scope sync now enforces no unused declarations.
35. ✅ **Check `operationId` uniqueness in CI** — `npm run check:operationIds` added and chained into `npm run validate`.

## Migration coverage backlog

- ⬜ Add `export-data-extension-rows` once REST read path is formally represented.
- ⬜ Add `export-content-builder-assets-full-tenant` recipe.
- ⬜ Add standalone `import-journey-event-definitions` recipe.
- ⬜ Add `export-contacts-by-attribute-set` after Contacts typing completion.
- ⬜ Add `import-contacts-upsert` after Contacts upsert body typing.
- ⬜ Add `export-audit-events` after audit envelope typing.
- ✅ Extend migration extension checks to validate recipe-referenced operations carry required migration metadata.
- ⬜ Add `x-idempotent: true` on read-only GETs.
- ⬜ Add MCP `plan_migration` composition tool.

## Current quality bar

To call this spec ready for broader v1.0, all remaining ⬜/🟡 items above should be completed and re-audited.
