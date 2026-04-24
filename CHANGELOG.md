# Changelog

All notable changes to this SFMC migration toolkit are documented in this file.

## [0.19.0] - 2026-04-24

### Added
- Added `check:operationIds` to enforce `operationId` uniqueness across all path fragments.
- Added `bundle:openapi` to emit a single-file bundled spec at `dist/sfmc.yaml`.
- Added this changelog to track spec/version milestones.

### Changed
- Updated `npm run validate` to include operationId uniqueness and bundling as part of the validation pipeline.

