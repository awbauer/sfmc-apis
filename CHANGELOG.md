# Changelog

All notable changes to this SFMC migration toolkit are documented in this file.

## [0.23.0] - 2026-04-30

### Added
- Added tenant-validated Journey History discovery/search coverage for `POST /interaction/v1/interactions/journeyhistory/summary`, `POST /interaction/v1/interactions/journeyhistory/filter`, and `POST /interaction/v1/interactions/journeyhistory/search`.
- Added typed schemas for Journey History summary totals, filter lists, search results, and nested result/error payloads based on live tenant responses.
- Added the missing root path reference for `DELETE /messaging/v1/securityHeaders/{pageType}`.
- Added a reusable accepted-request response envelope schema for asynchronous/accepted routes that return a `requestId`.

### Changed
- Tightened discovery schemas to match live tenant behavior for `/platform/v1/endpoints`, `/platform/v1/endpoints/{endpointType}`, and `/platform/v1/tokenContext`.

## [0.22.0] - 2026-04-30

### Added
- Added tenant-confirmed Security Headers write-route coverage for `POST /messaging/v1/securityHeaders` and `DELETE /messaging/v1/securityHeaders/{pageType}`.
- Added `http_headers_update` and `http_headers_delete` installed-package scopes to the declared OAuth2 scope catalog.
- Added a typed request schema for Security Headers updates and modeled the accepted delete response envelope.

## [0.21.0] - 2026-04-30

### Added
- Added Security Headers coverage for `GET /messaging/v1/securityHeaders` and `GET /messaging/v1/securityHeaders/all`.
- Added Journey History coverage for `GET /interaction/v1/interactions/journeyhistory/freshness`, `POST /interaction/v1/interactions/journeyhistory/estimate`, and `POST /interaction/v1/interactions/journeyhistory/download`.
- Added the `http_headers_view` installed-package scope to the declared OAuth2 scope catalog.
- Added response schemas for tenant HTTP security-header catalogs, page-type-specific header configuration, Journey History export requests, Journey History freshness, and Journey History size estimates.

## [0.20.0] - 2026-04-30

### Added
- Added Security Headers coverage for `GET /messaging/v1/securityHeaders` and `GET /messaging/v1/securityHeaders/all`.
- Added the `http_headers_view` installed-package scope to the declared OAuth2 scope catalog.
- Added response schemas for tenant HTTP security-header catalogs and page-type-specific header configuration.

## [0.19.0] - 2026-04-24

### Added
- Added `check:operationIds` to enforce `operationId` uniqueness across all path fragments.
- Added `bundle:openapi` to emit a single-file bundled spec at `dist/sfmc.yaml`.
- Added this changelog to track spec/version milestones.

### Changed
- Updated `npm run validate` to include operationId uniqueness and bundling as part of the validation pipeline.

