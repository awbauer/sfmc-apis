# Executive Report: SFMC Tenant and Migration-Toolkit Assessment

_Date:_ 2026-04-30

## Executive summary

Across the three reports, the strongest conclusion is this:

- the `sfmc-apis` toolkit is **real and usable** against the live tenant
- the tenant itself appears **healthy enough to operate**, but **large enough to require stronger governance**
- the biggest near-term opportunity is **not rescuing a broken platform**; it is improving **coverage, control, and operating discipline**

This executive summary is weighted toward the last two reports:

1. **tenant deep-dive validation**
2. **tenant architecture recommendations**

## What we validated

Using read-only API testing against the live SFMC tenant, we confirmed:

- authentication works with the installed package
- the repo/toolkit works credibly for **Journey Builder** discovery/export planning
- the repo/toolkit works credibly for **Content Builder** discovery/export planning
- the tenant also supports useful **Automation Studio** read-side discovery

Observed tenant scale from the API sample:

- **896 journeys**
- **784 event definitions**
- **593 automations**
- **639 Content Builder categories**
- **1,377 assets** observed under the root Content Builder folder sample

## What this means

### For the migration toolkit

The toolkit is not theoretical. It works against the tenant and is already useful for migration discovery work.

Current strengths:

- Journey Builder export planning
- event definition export planning
- Content Builder folder and asset discovery
- scope-aware recipe guidance

Current gaps:

- Data Extension export support is too thin
- Automation Studio is promising but under-modeled
- many tenant-granted scopes are not yet represented in the repo
- search / family normalization / scope modeling need polish

### For the tenant

The tenant does **not** primarily look like a capability problem.
It looks like a **governance and operating-model maturity problem**.

That is actually good news. It means the biggest improvements are organizational and architectural, not emergency remediation.

## Main findings from the deep dive

### 1. The tenant can do more than the repo currently models

The installed package returned **36 scopes**, but only **16** had matching representation in the repo catalog during review.

Implication:

- the tenant has broader practical capability than the current toolkit exposes
- the repo should not yet be treated as a complete tenant capability map

### 2. Journey Builder is the strongest validated area

The Journey Builder flow worked cleanly end-to-end:

- list journeys
- fetch journey details
- list event definitions
- fetch event definition details

Implication:

- this is the most mature and trustworthy migration-discovery surface in the current toolkit

### 3. Content Builder is also solid, but scope modeling needs work

Content Builder reads succeeded in practice, including:

- category listing
- category detail
- asset query
- asset detail

But the returned scope list did not clearly advertise the read scope the repo expected.

Implication:

- runtime behavior and declared scope assumptions do not line up cleanly
- prerequisite logic should be reviewed against real tenant behavior

### 4. Automation Studio is usable but underdeveloped in the repo

Automation Studio read calls worked and surfaced a large active portfolio.

Implication:

- the repo has room to expand beyond its current migration families
- automation discovery should likely become a modeled recipe family

### 5. Data Extensions are the most important uncovered migration gap

The tenant has `data_extensions_read`, but the repo currently models only two export-side read operations there, both polling-related.

Implication:

- Data Extension export/discovery is the highest-value repo enhancement area
- this is especially important because DE governance is usually where SFMC migration complexity concentrates

## Architectural read on the tenant

The tenant appears to be:

- real
- active
- mature
- organically grown
- in need of stronger formal standards

The observed scale strongly suggests the need for better discipline around:

- ownership
- naming
- lifecycle management
- taxonomy
- automation governance
- integration governance
- observability

In plain English: the tenant seems to have grown to the point where informal norms are no longer enough.

## Highest-priority recommendations

## A. Tenant/platform recommendations

### 1. Establish inventory and ownership immediately

Create a governed inventory for:

- journeys
- event definitions
- automations
- Data Extensions
- content assets/folders
- installed packages/integrations

Every object family needs:

- business owner
- technical owner
- purpose
- lifecycle state
- BU/environment context

### 2. Standardize naming and taxonomy

Prioritize naming standards for:

- journeys
- automations
- event definitions
- folders
- assets
- DEs

Also establish a Content Builder folder taxonomy and archive/deprecation zones.

### 3. Rationalize journey and event-definition sprawl

At nearly 900 journeys and nearly 800 event definitions, there is likely avoidable duplication and historical clutter.

Focus on:

- inactive vs active
- obsolete versions
- duplicate patterns
- orphaned event definitions
- test/demo residue

### 4. Harden Automation Studio governance

With nearly 600 automations, the goal should be portfolio management, not just coexistence.

Every automation should have:

- owner
- purpose
- dependency map
- criticality/SLA
- failure response expectation

### 5. Make Data Extension governance a major workstream

Even though DEs were not deeply inspected here, they are likely the biggest migration and operating-risk area.

Review:

- naming
- retention
- sendability
- keys
- field design
- duplication
- source-of-truth clarity
- PII/compliance treatment

### 6. Review installed package and secret hygiene

The package is broad enough that it should be periodically reviewed for:

- least privilege
- ownership
- purpose
- rotation process
- environment boundaries

Also: the secret used in testing was shared in chat and should be rotated.

## B. Toolkit/repo recommendations

### 1. Expand Data Extension export coverage

Highest repo priority.

Add support for:

- DE discovery/listing
- schema/field inspection
- row export strategy
- export recipes, not just import and async pollers

### 2. Add a repeatable tenant smoke/deep-dive script

Formalize validation for:

- auth
- journey list/detail
- event definition list/detail
- content category list/detail
- asset query/detail
- automation list/detail

### 3. Improve scope/prerequisite logic

Especially for Content Builder reads where observed behavior differed from the declared scope expectation.

### 4. Improve search and family normalization

`get_endpoint_for_task` and family mapping should be more forgiving and more human-readable.

### 5. Add Automation Studio recipe coverage

The tenant supports useful automation discovery. The repo should expose that more intentionally.

## Suggested executive action plan

## Next 30 days

- stand up tenant inventory and ownership register
- review installed packages and rotate exposed secret
- define naming standards and folder taxonomy
- identify top critical journeys, automations, and DEs
- add tenant smoke/deep-dive script to repo

## Next 60 days

- rationalize journeys, event definitions, and test/demo clutter
- formalize archive/deprecation rules
- begin Data Extension governance review
- add Data Extension export coverage to the repo

## Next 90 days

- publish governance playbook
- establish recurring health reporting
- implement automation portfolio governance
- broaden repo coverage to better match tenant capability

## Bottom line

The good news is that both the tenant and the migration toolkit are viable.

The more important message is this:

- **the platform is usable now**
- **the toolkit is useful now**
- **the biggest gains ahead come from governance, Data Extension discipline, and broader modeled coverage**

If addressed well, those improvements should make future migration work, operations, auditability, and change management materially easier.
