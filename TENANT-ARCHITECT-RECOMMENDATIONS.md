# SFMC Tenant Improvement Recommendations

_Date:_ 2026-04-30

## Perspective

This report is written from the perspective of an experienced Salesforce Marketing Cloud architect reviewing a live tenant through a limited, read-only API lens.

It is **not** a full platform assessment. I did not inspect sends, subscribers, Data Extension schemas, SQL activities, integration code, user roles, deliverability setup, or business process documentation. So these recommendations should be treated as:

- informed architectural recommendations
- prioritized hypotheses based on observed tenant patterns
- a starting point for a more formal SFMC health assessment

## What I observed at a high level

From the read-only API sampling:

- Journeys: `896`
- Event definitions: `784`
- Automations: `593`
- Content Builder categories: `639`
- Root Content Builder asset count observed: `1377`

I also saw enough naming and structural variation to suggest a tenant that has grown organically over time rather than through a tightly enforced governance model.

That is normal. It is also exactly when architecture discipline starts paying off.

## Executive summary

If this were my tenant, I would focus improvement efforts in this order:

1. **Governance and inventory first**
2. **Naming, taxonomy, and lifecycle control second**
3. **Journey / entry event rationalization third**
4. **Automation and data-operating-model hardening fourth**
5. **Package, scope, and integration hygiene fifth**
6. **Migration-readiness and observability as an ongoing discipline**

The tenant does not look broken. It looks **mature enough to need formal operating standards**.

## 1. Establish a real tenant inventory and ownership model

### Why

The object counts alone are enough to justify it:

- ~900 journeys
- ~800 event definitions
- ~600 automations
- ~600 folders

At this size, undocumented ownership becomes a risk multiplier.

### Recommendation

Create and maintain a governed inventory for at least these SFMC asset families:

- journeys
- event definitions
- automations
- Data Extensions
- content assets / folders
- send definitions / triggered-send style artifacts if still present
- installed packages and API integrations

Each record should include:

- business owner
- technical owner
- purpose
- source system / downstream dependency
- lifecycle state (`active`, `deprecated`, `candidate for archive`, `retired`)
- BU / environment
- created date / last modified date / last run date where applicable

### Why this matters

Without ownership, you cannot safely:

- rationalize assets
n- reduce risk before migration
- manage deprecation
- separate critical from non-critical workloads

## 2. Standardize naming conventions immediately

### Why

The sampled tenant objects show signs of mixed naming quality:

- strong business names like `Welcome Email`
- ambiguous names like `Demo`
- inconsistent names like `Wingstop Demo`
- at least one automation with a blank name
- a mix of system-like keys and human-friendly labels

This is survivable at small scale. At this scale, it becomes drag.

### Recommendation

Define naming standards for at least:

- journeys
- event definitions
- automations
- Data Extensions
- folders
- content assets
- API integration keys / external keys where controllable

Good naming should encode:

- business domain or brand
- purpose
- channel
- lifecycle or environment if relevant
- version only where versioning is intentional

Example pattern ideas:

- `BRAND_USECASE_CHANNEL_STAGE`
- `DOMAIN_AUDIENCE_TRIGGER_ACTION`
- `BU_TEAM_OBJECT_PURPOSE`

The exact pattern matters less than consistency.

### Priority cleanup targets

Start by flagging:

- blank names
- `Demo` / `Test` / `Copy` / ad hoc artifacts
- folders with inconsistent spacing or punctuation
- automations or journeys whose names do not reveal business purpose

## 3. Rationalize Journey Builder and event definition sprawl

### Why

`896` journeys and `784` event definitions is a lot.

That does not automatically mean bloat, but it strongly suggests the need for review around:

- duplicates
- old versions still lingering
- one-off campaign journeys that never got retired
- event definitions created faster than they were governed
- overlapping entry-source patterns

### Recommendation

Run a structured rationalization across:

- active vs inactive journeys
- most recent vs obsolete versions
- journeys with no recent entry activity
- event definitions not referenced by active journeys
- duplicated or near-duplicated journey patterns

### Specific architect questions to answer

- Are there standardized journey templates, or does every team invent its own structure?
- How many event definitions are production-critical vs historical clutter?
- Are contact-entry rules and re-entry policies governed consistently?
- Is there a clean split between transactional, lifecycle, and campaign journeys?

### Improvement goal

Fewer, more reusable, more understandable journeys with clearly governed entry sources.

## 4. Introduce a formal folder and asset taxonomy for Content Builder

### Why

Content Builder appears heavily used:

- `639` categories
- `1377` assets visible under the root Content Builder folder sample

That is enough complexity for asset discoverability to become a real operating problem.

### Recommendation

Define a folder taxonomy with explicit rules, for example by:

- brand / BU
- channel
- campaign type
- reusable templates vs one-off assets
- archive / deprecated zones

Separate at least these classes of assets logically:

- reusable templates
- approved modular content
- images / documents
- journey-specific assets
- package/system deployment artifacts
- archive/deprecated assets

### Why this matters

Without taxonomy, teams compensate with memory and tribal knowledge.
That fails under migration, turnover, and audit pressure.

### Specific note from the sample

I saw asset types like:

- `packagedeployment`
- `png`

That mix is fine, but it reinforces the need to distinguish:

- operational/system assets
- design assets
- reusable marketing content

## 5. Clean up test/demo/dev residue

### Why

The sample included naming patterns like:

- `Demo`
- `Wingstop Demo`
- folder names like `ss`
- test-like folder and automation names

That usually means one of three things:

- the tenant is serving as both production and sandbox-ish workspace
- retirements are not being enforced
- proof-of-concept work is not being segregated well enough

### Recommendation

Create a cleanup program for:

- test/demo journeys
- obsolete event definitions
- unused folders
- sample assets
- non-production automations left in production spaces

### Governance rule

No proof-of-concept or training artifact should survive indefinitely in production without explicit justification.

## 6. Harden Automation Studio governance

### Why

`593` automations is enough to create serious operational complexity.

The sampled automation statuses included:

- `Ready`
- `Building`
- `Scheduled`

This suggests a mix of active and in-flight automation behavior, which is normal, but it increases the importance of discipline around:

- scheduling
- dependencies
- monitoring
- naming
- failure handling
- retirement

### Recommendation

For each automation, define:

- owner
- purpose
- upstream dependency
- downstream dependency
- SLA / business criticality
- failure response process
- archive criteria

### Specific architect concern

An automation with a blank name is a smell. Even if it is harmless, it indicates weak enforcement somewhere in the operating model.

### Improvement target

Move from “automation collection” to “automation portfolio management.”

## 7. Treat Data Extension governance as a priority, even though this sample did not inspect DE schemas

### Why

For most SFMC estates, Data Extensions are where risk, technical debt, and migration pain concentrate.

Even though the API repo currently under-models DE export, that does **not** make DEs less important. It makes them more urgent to assess deliberately.

### Recommendation

Run a formal DE governance review covering:

- naming standards
- retention policies
- sendable vs non-sendable classification
- primary key discipline
- field typing discipline
- source-of-truth clarity
- duplication across BUs / teams
- contact model alignment
- PII / compliance tagging

### Key architect questions

- Which DEs are system-of-record mirrors vs campaign work tables?
- Where are DEs being used as permanent storage when they should be transient?
- Are retention policies actually configured and appropriate?
- Is there a clear model for shared vs local DEs?

### Migration significance

If a future migration is in scope, DE sprawl and inconsistent schemas are often the hardest part of the move.

## 8. Review installed-package and scope hygiene

### Why

The package used in testing has a fairly broad set of scopes. That is common, but broad API access should always be periodically reviewed.

I also observed that effective read behavior did not line up perfectly with the returned scope string in one area, which is another reason to validate package governance carefully.

### Recommendation

Review every installed package for:

- actual owner
- business purpose
- least-privilege scope design
- credential rotation history
- environment separation
- dependency mapping
- deprecation plan if unused

### Governance rule

No long-lived integration package should exist without:

- named owner
- documented purpose
- scope rationale
- secret rotation process
- environment classification

## 9. Separate production operating standards from migration tooling needs

### Why

A migration-support repo like `sfmc-apis` is useful, but it should not become the only source of tenant understanding.

Tenant improvement needs a broader operating model than migration alone.

### Recommendation

Define two explicit tracks:

1. **Platform governance track**
   - naming
   - foldering
   - ownership
   - lifecycle
   - security
   - standards

2. **Migration readiness track**
   - exportability
   - metadata inventory
   - dependency mapping
   - cutover sequencing
   - rollback planning

These tracks overlap, but they are not the same.

## 10. Build observability and health reporting into the tenant operating model

### Why

At this scale, teams need reporting that answers:

- what is active
- what is failing
- what is unused
- what is duplicative
- what is ownerless
- what is risky to change

### Recommendation

Create recurring health dashboards or extracts for:

- active journeys by owner / BU
- event definitions by use and last activity
- automations by status, failure rate, and owner
- DEs by retention posture and sendability
- content assets by age, location, and reuse
- installed packages by scope breadth and last reviewed date

This can start as spreadsheets if needed. It does not need to start fancy.

## 11. Create archive and deprecation standards

### Why

Most mature SFMC tenants become harder to operate because nothing ever truly leaves.

### Recommendation

Define clear archive/deprecation rules for:

- journeys
- automations
- event definitions
- content assets
- folders
- DEs

Suggested lifecycle states:

- `draft`
- `active`
- `maintenance`
- `deprecated`
- `archived`
- `retired`

Then make those states operationally meaningful.

## 12. Formalize environment strategy if it is not already formalized

### Why

The presence of demo/test naming inside what appears to be a live tenant often means environment boundaries are blurry.

### Recommendation

Confirm and document:

- what is production
- what is lower environment / sandbox / training space
- where proofs of concept belong
- which integrations can hit which environments
- how content and journeys are promoted between environments

If lower-environment discipline is weak, production cleanliness will always drift.

## Suggested 90-day improvement roadmap

## First 30 days

- create tenant inventory for journeys, automations, event definitions, DEs, content folders/assets, and packages
- define naming standards
- identify top 50 most business-critical journeys and automations
- flag blank, test, demo, and obsolete artifacts
- review installed packages and owners

## Days 31-60

- implement folder/content taxonomy
- review Journey Builder and event-definition duplication
- define archive/deprecation process
- start DE governance review
- define automation ownership and operational criticality

## Days 61-90

- retire obvious clutter
- publish governance playbook
- establish recurring health reporting
- define migration-readiness inventory and dependency maps
- formalize secret rotation and integration review cadence

## Final assessment

My architectural read is this:

This tenant looks like a real, working, fairly mature SFMC environment that has accumulated enough scale to justify stronger governance.

The headline problem is probably **not** platform capability.
The headline problem is likely **operating model maturity**.

That is good news, because operating-model problems are solvable:

- standardize naming
- assign ownership
- rationalize assets
- enforce lifecycle
- tighten package governance
- improve observability

If you do those things well, migration projects get easier, incidents get easier, onboarding gets easier, and platform trust improves.

## Important caveat

These recommendations are based on limited API-visible evidence and architectural pattern recognition, not a full tenant audit. A formal assessment should include:

- DE schema review
- SQL activity review
- send classification review
- deliverability and sender-authentication review
- subscriber/contact model review
- BU / org design review
- user-role and permission review
- integration landscape review
