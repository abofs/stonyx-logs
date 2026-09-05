# SME Template: Validation Loop Team — Stonyx Logs

> **Inherits from:** `beatrix-shared/docs/framework/templates/agents/validation-loop-team.md`
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

- Two-class design: `Log` (orchestrator) delegates color resolution to `Color` (chalk wrapper)
- Constructor merges `systemLogs` defaults (`info: cyan`, `warn: yellow`, `error: red`) with user-provided `additionalLogs`
- Runtime method generation: `createConvenienceMethod()` attaches logging functions to the `Log` instance via index signature `[key: string]: unknown`
- Option resolution chain: per-type overrides in `typeOptions[type]` fall back to global `this.options`
- File operations: fully async via `fs.promises`; directory creation uses `await fsp.mkdir(path, { recursive: true })`, deduped by an instance-level promise cache. There is no synchronous fs call on the write path, and `test/write-path-test.ts` ships a static assertion that fails if one reappears in `src/index.ts`
- Filename templating with `resolveFilename()` supports `{date}`, `{type}`, `{pid}`, `{hostname}` variables; sanitizes path traversal characters
- The `debug()` method is hardcoded separately from the dynamic method system, using `console.dir` with depth 6

## Live Knowledge

- The codebase is compact: only two source files (`src/index.ts`, `src/color.ts`)
- No external dependencies beyond chalk; all file I/O uses Node built-ins (`fs`, `path`, `os`, `url`)
- `settingToChalkColorFunction()` in Color validates that the resolved function actually returns a string, preventing silent misconfiguration
- `validateFileAndDirectory()` ensures the log directory exists, deduping concurrent and repeat calls onto one `mkdir` per directory via an instance-level promise cache. It creates no file (both write paths already create the target), and it swallows nothing: write failures reject out of `writeToFile()` and the rejection is the caller's only failure signal
- The package uses dual exports (`"."` and `"./color"`) so consumers can import the Color class independently
- Test suite covers unit tests (log-test, color-test, filename-test) and integration tests; runs via `pnpm test` which builds both source and test TypeScript before executing QUnit
- Alpha versions are published on PR, beta on merge to main, stable on manual dispatch -- all managed by the shared `stonyx-workflows` npm-publish workflow
