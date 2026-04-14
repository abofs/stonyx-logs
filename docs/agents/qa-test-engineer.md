# SME Template: QA Test Engineer — Stonyx Logs

> **Inherits from:** `beatrix-shared/docs/framework/templates/agents/qa-test-engineer.md`
> Load the base template first, then layer this project-specific context on top.

## Project Context

**Repo:** `abofs/stonyx-logs`
**Framework:** Stonyx utility package published to npm as `@stonyx/logs`
**Domain:** Color-coded console and file logging for Node.js applications, built on top of chalk

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict, ESM) |
| Runtime | Node.js 24.x |
| Package Manager | pnpm 9 |
| Build | `tsc` (two configs: `tsconfig.json` for dist, `tsconfig.test.json` for dist-test) |
| Test Framework | QUnit (unit + integration suites) |
| Test Doubles | Sinon (stubs/spies for console output and file system) |
| Dependency | chalk 5.x (ESM-only) |
| CI | Reusable workflow from `abofs/stonyx-workflows` |
| Publishing | npm OIDC trusted publishing with alpha/beta/stable channels |

## Architecture Patterns

- Single default export `Log` class in `src/index.ts` with a companion `Color` class in `src/color.ts`
- Dynamic convenience methods generated at runtime from `systemLogs` and `additionalLogs` config (e.g., `log.info()`, `log.warn()`, `log.error()`)
- `defineType()` allows post-construction registration of new log types with custom chalk functions or color strings
- Per-type option overrides via `typeOptions` map (prefix, suffix, path, filename can differ per log type)
- File logging is async (`fs.promises`) with automatic directory creation via `mkdirSync`
- Dynamic filename resolution supports `{date}`, `{type}`, `{pid}`, `{hostname}` template variables with path-traversal sanitization
- `debug()` is a hardcoded method that uses `console.dir` instead of chalk coloring, with `JSON.stringify` for file output
- Color resolution: string starting with `#` uses `chalk.hex()`, plain strings map to named chalk methods, functions are passed through with validation

## Live Knowledge

- Tests are in plain JS under `test/unit/` (log-test, color-test, filename-test) and `test/integration.js`; they compile from `tsconfig.test.json` into `dist-test/`
- The `pnpm test` script chains `build`, `build:test`, then runs QUnit on `dist-test/test/unit/**/*-test.js`
- chalk 5.x is ESM-only, so the project must use `"type": "module"` and `.js` extensions in imports
- The package exports two entry points: `.` (default Log class) and `./color` (Color class)
- `sanitizePath()` resolves log file paths relative to the consumer's project root by splitting on `node_modules` or `src`
- File write operations return promises, allowing `await log.error('msg', true)` for guaranteed write completion
- `logToFile` parameter defaults to `false` unless `logToFileByDefault` is set in constructor options
