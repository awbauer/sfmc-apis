# SFMC Tenant Deep Dive Validation

_Date:_ 2026-04-30

## Purpose

This report goes deeper than the initial smoke test and focuses on how `sfmc-apis` behaves against a live Salesforce Marketing Cloud tenant when used as an agent support layer for migration discovery work.

The testing remained **read-only**.

## Scope of this deep dive

I focused on three questions:

1. Which parts of the repo/spec are realistically usable with the tenant's installed-package scopes?
2. Do the repo's export-oriented flows actually map to working tenant behavior?
3. Where are the biggest gaps between tenant capability and repo coverage?

## Test setup

- Repo: `awbauer/sfmc-apis`
- Local clone: `/Users/andrewbauer/GitHub/sfmc-apis`
- Tenant auth: server-to-server token flow via `/v2/token`
- Access pattern: read-only REST calls only

## Authentication result

Authentication succeeded.

### Token response snapshot

- HTTP status: `200`
- auth round-trip observed: ~`512 ms`
- token lifetime observed: `1079` seconds
- returned scope count: `36`

### Tenant scopes returned during test

- `offline`
- `documents_and_images_write`
- `saved_content_read`
- `automations_read`
- `journeys_read`
- `email_read`
- `push_read`
- `sms_read`
- `social_read`
- `web_read`
- `audiences_read`
- `list_and_subscribers_read`
- `data_extensions_read`
- `file_locations_read`
- `calendar_read`
- `campaign_read`
- `accounts_read`
- `users_read`
- `webhooks_read`
- `approvals_read`
- `tags_read`
- `workflows_read`
- `ott_chat_messaging_read`
- `ott_channels_read`
- `marketing_cloud_connect_read`
- `marketing_cloud_connect_write`
- `marketing_cloud_connect_send`
- `event_notification_callback_read`
- `event_notification_subscription_read`
- `deep_linking_asset_read`
- `deep_linking_settings_read`
- `market_audience_view`
- `market_audience_member_view`
- `contact_bu_mapping_view`
- `http_headers_view`
- `e360_analytics_provisioning_view`

## Repo/spec coverage vs tenant scopes

I compared the tenant scope list against the operation scopes present in `dist/migration-catalog.json`.

### Coverage summary

- tenant scopes observed: `36`
- scopes represented somewhere in the repo catalog: `16`
- tenant scopes with **no matching operation** in the repo catalog: `20`

### Scopes represented in the catalog

Most represented / immediately testable:

- `journeys_read` — `22` operations
- `sms_read` — `19` operations
- `list_and_subscribers_read` — `17` operations
- `push_read` — `11` operations
- `tags_read` — `7` operations
- `documents_and_images_write` — `6` operations
- `saved_content_read` — `6` operations
- `automations_read` — `6` operations
- `email_read` — `6` operations
- `ott_channels_read` — `5` operations
- `campaign_read` — `4` operations
- `approvals_read` — `4` operations
- `audiences_read` — `2` operations
- `data_extensions_read` — `2` operations
- `event_notification_callback_read` — `2` operations
- `event_notification_subscription_read` — `2` operations

### Scopes not represented in the catalog

These appeared in the token but had no matching operation in the repo catalog during this review:

- `accounts_read`
- `users_read`
- `webhooks_read`
- `workflows_read`
- `social_read`
- `web_read`
- `file_locations_read`
- `calendar_read`
- `ott_chat_messaging_read`
- `marketing_cloud_connect_read`
- `marketing_cloud_connect_write`
- `marketing_cloud_connect_send`
- `deep_linking_asset_read`
- `deep_linking_settings_read`
- `market_audience_view`
- `market_audience_member_view`
- `contact_bu_mapping_view`
- `http_headers_view`
- `e360_analytics_provisioning_view`
- `offline`

### Takeaway

The tenant can do more than the repo currently models. `sfmc-apis` is already useful, but it is **not yet a broad tenant coverage map**. It is strongest today in the families it explicitly focuses on.

## Journey Builder deep dive

This was the cleanest end-to-end fit with the repo's migration recipes, especially `export-journey-definitions`.

### Calls tested

- `GET /interaction/v1/interactions`
- `GET /interaction/v1/interactions/{id}` for 3 sample journeys
- `GET /interaction/v1/eventDefinitions`
- `GET /interaction/v1/eventDefinitions/{id}` for 3 sample event definitions

### Results

All tested calls succeeded with HTTP `200`.

### List behavior

- journey list response time observed: ~`3079 ms`
- total journeys reported: `896`
- sample journeys returned immediately and looked usable for export planning

### Sample journey detail results

Fetched 3 detail payloads successfully.

Examples observed:

- `Demo`
  - version `1`
  - workflow API version `1`
  - `1` trigger
  - `13` activities
- `Welcome Email`
  - version `1`
  - `1` trigger
  - `2` activities
- `Wingstop Demo`
  - version `1`
  - `1` trigger
  - `14` activities

### Event definition results

- event definition list response time observed: ~`171 ms`
- total event definitions reported: `784`
- fetched 3 event definition details successfully

Sample event types observed:

- `EmailAudience`
- `ContactAudience`

### Journey Builder assessment

This is the strongest part of the repo/tenant match.

The recipe shape is valid in practice:

1. list journeys
2. fetch journey details
3. list event definitions
4. fetch event definition details

An agent could use this surface today for real export discovery work.

## Content Builder deep dive

This also matched the repo well, especially:

- `export-content-builder-folders`
- `export-content-builder-assets-by-folder`

### Calls tested

- `GET /asset/v1/content/categories`
- `GET /asset/v1/content/categories/{id}` for 3 sample folders
- `POST /asset/v1/content/assets/query`
- `GET /asset/v1/content/assets/{id}` for 3 sample assets

### Results

All tested calls succeeded with HTTP `200`.

### Folder/category behavior

- category list response time observed: ~`209 ms`
- total categories reported: `639`
- fetched 3 category detail payloads successfully

Sample categories observed:

- `Content Builder`
- `Wingstop Demo Content `
- `Images`

Sample category detail fields present:

- `id`
- `name`
- `parentId`
- `memberId`
- `categoryType`

### Asset query behavior

The root `Content Builder` folder returned a large asset population:

- root folder asset count observed: `1377`

Fetched 3 asset details successfully.

Sample asset types observed:

- `packagedeployment`
- `png`

### Important nuance

One earlier child-folder test returned zero assets, but broader sampling showed the endpoint itself works correctly. The real lesson is:

- some folders are empty
- sampling logic should not assume every child folder contains assets
- recipe runners should be prepared to probe multiple folders or continue gracefully on empty folders

### Scope mismatch observation

The token scope snapshot did **not** clearly show `documents_and_images_read`, but all tested Content Builder read endpoints still worked.

That means at least one of these is true:

- effective access is broader than the raw token scope string suggests
- SFMC scope reporting is not the whole story for these reads
- the repo's current prerequisite assumptions are stricter than observed tenant behavior

### Content Builder assessment

This family is usable in practice and worth trusting for read-only migration discovery.

The main improvement needed is not endpoint validity; it is **scope/prerequisite modeling**.

## Automation Studio read probe

Automation Studio is not currently a first-class migration recipe family in the repo, but the tenant has `automations_read`, and the catalog includes some GET operations. I tested it as an adjacent discovery surface.

### Calls tested

- `GET /automation/v1/automations`
- `GET /automation/v1/automations/{id}` for 3 sample automations

### Results

All tested calls succeeded with HTTP `200`.

### Observed behavior

- automation list response time observed: ~`208 ms`
- total automations reported: `593`
- fetched 3 automation details successfully

Sample statuses observed:

- `Ready`
- `Building`
- `Scheduled`

### Automation Studio assessment

This is promising, but it is **under-modeled** in the repo.

The tenant clearly supports useful read-side automation discovery, but `sfmc-apis` does not yet turn that into migration-oriented recipes or richer agent guidance.

## Data Extensions gap

This is one of the biggest structural gaps revealed by the deep dive.

### What the tenant has

- `data_extensions_read`

### What the repo currently models for export

Only 2 read-side operations showed up under `data_extensions_read`:

- `GET /data/v1/async/{requestId}/status`
- `GET /data/v1/async/{requestId}/results`

These are **polling endpoints**, not discovery or export kickoff endpoints.

### Why this matters

The repo includes import-oriented Data Extension recipes, but it does **not** currently give an agent a strong export-side route for:

- listing Data Extensions
- describing schemas/fields
- kicking off row exports
- retrieving rows from a DE in a recipe-shaped way

### Assessment

For migration work, Data Extensions are too important for this gap to remain. This is probably the highest-value expansion area after the current Journey Builder / Content Builder strengths.

## Overall findings

## What is solid right now

`sfmc-apis` works credibly today as an agent support toolkit for these tenant-backed read flows:

- Journey Builder discovery/export planning
- event definition discovery/export planning
- Content Builder folder discovery
- Content Builder asset discovery/export planning
- limited Automation Studio read-side discovery

## What is only partially there

- task search / endpoint lookup ergonomics
- family normalization between human names, recipe family slugs, and tags
- scope modeling in cases where runtime behavior appears broader than declared assumptions

## What is missing relative to tenant capability

- broad modeling for many tenant scopes already granted by the package
- user/account discovery coverage
- workflow/webhook-related coverage
- stronger Data Extension export support
- migration recipes for Automation Studio or other adjacent operational families

## Recommendations

### Highest priority

1. **Add a repeatable tenant deep-dive smoke test script**
   - auth
   - journey list + detail
   - event definition list + detail
   - content category list + detail
   - asset query + detail
   - automation list + detail
   - structured JSON output

2. **Fix scope/prerequisite modeling around Content Builder reads**
   - current observed behavior does not cleanly match the returned scope string

3. **Expand Data Extension export coverage**
   - DE discovery/listing
   - schema inspection
   - row export strategy
   - recipe support for export, not just import and polling

### Medium priority

4. **Improve `get_endpoint_for_task`**
   - normalize family names
   - reduce dependence on exact token overlap
   - incorporate tag/family aliases

5. **Add migration-oriented coverage for Automation Studio**
   - read-side recipe(s) for automation discovery/export planning

6. **Broaden scope-family coverage**
   - especially for scopes already present in the tenant but absent from the catalog

## Bottom line

The repo is not just theoretically correct — it works against a real tenant.

But the deep dive makes its current shape clearer:

- it is **strong and practical** in Journey Builder and Content Builder
- it is **promising but thin** in Automation Studio
- it is **underpowered where Data Extension export should probably be one of the main stories**
- it still leaves a lot of tenant-granted capability uncovered

That is a good place to be, honestly: the foundation is real. The next gains are mostly about **coverage and ergonomics**, not rescuing a broken design.

## Security note

The installed-package client secret used during testing was provided directly in chat. It should be rotated after testing is complete.
