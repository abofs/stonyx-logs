# @stonyx/logs

Simplified logging for Node.js applications. Built on [chalk](https://www.npmjs.com/package/chalk), providing fully configurable, expressive console and file logging.

## Documentation

- [README](../README.md) -- usage examples, API reference, and configuration options
- [Release instructions](release.md)

## Verification

- **Run tests:** `pnpm test` (QUnit, tests in `test/`)
- **Lint:** `pnpm lint` (ESLint with auto-fix)

## Overview

@stonyx/logs provides:
- Configurable log types with color-coded console output
- File logging with optional timestamps, prefixes, and suffixes
- Custom log type definitions via `defineType()`
- Async file-write support with `await`

> **Note:** The internal class is named `Log`. See [abofs/stonyx-logs#11](https://github.com/abofs/stonyx-logs/issues/11) for the rename tracking issue.
