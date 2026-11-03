# @stonyx/logs architecture

`@stonyx/logs` is a simplified, configurable, color-coded logger for Node.js applications. It
provides console logging and optional file logging, built on top of
[chalk](https://www.npmjs.com/package/chalk) for terminal color. The whole package is two source
files (`src/index.ts`, `src/color.ts`) plus their test suite; there is no build-time code
generation or framework beyond TypeScript compiling to `dist/`.

## Areas

### The `Log` class and color resolution

The `Log` class (`src/index.ts`) merges a `systemLogs`/`additionalLogs` configuration into a set
of log types, generates one convenience method per type (`log.info()`, `log.warn()`, ...), and
delegates all color handling to the `Color` class (`src/color.ts`), which turns a color setting —
a named chalk color, a `#hex` string, or a raw chalk function — into a validated chalk function.
See [docs/areas/log-class-and-color.md](areas/log-class-and-color.md) for the full breakdown,
including the internal-class-naming note (`Log`, tracked for a rename in
[abofs/stonyx-logs#11](https://github.com/abofs/stonyx-logs/issues/11)).

### File-logging path resolution and the write path

When `logToFile` is set, `Log` resolves a target path against the consumer's project root,
supports template variables (`{date}`, `{type}`, `{pid}`, `{hostname}`) in file names, and writes
asynchronously through `fs.promises`, deduplicating directory creation across concurrent writers
with an instance-scoped cache. There is no synchronous file I/O anywhere on this path. See
[docs/areas/file-logging.md](areas/file-logging.md) for path resolution, the write/retry
semantics, and the failure contract (a rejected promise is the only failure signal).

### Custom log type definitions via `defineType()`

Beyond the built-in `info`/`warn`/`error`/`debug` types, `defineType(type, setting, options)` lets
a consumer register new log types, replace existing ones, or override the color/path/prefix/etc.
for a single type without changing the global configuration. See
[docs/areas/custom-types.md](areas/custom-types.md) for the validation rules and how it relates
to the constructor's `additionalLogs` option.

### Canonical usage samples

Unlike some other Stonyx packages (`discord`, `events`, `utils`), this repo does **not** currently
have a `test/sample/` directory of canonical, test-exercised usage samples. That pattern is
requested but not implemented here — see
[abofs/stonyx-logs#47](https://github.com/abofs/stonyx-logs/issues/47) ("Add `test/sample/`
canonical usage samples"), which is open but labeled `documentation` / `on-hold` / `blocked` and is
not being worked. Until it lands, the [README](../README.md) and the area docs above are the
usage reference.

## Build, Run, Test

Verified in this repo on Node v24.13.0 / pnpm 10.23.0:

```sh
pnpm install --frozen-lockfile   # installs cleanly against the committed lockfile
pnpm test                        # QUnit, via tsx; 79 tests, all passing
pnpm lint                        # ESLint with --fix; no findings, no file changes
pnpm run build                   # tsc -> dist/ (used by prepublishOnly and the CI build step)
```

- `test` resolves to `node --import tsx node_modules/qunit/bin/qunit.js 'test/**/*-test.ts'`.
  Tests live in `test/` (`test/integration-test.ts`, `test/unit-misc-test.ts`,
  `test/write-path-test.ts`, `test/unit/*.ts`).
- `lint` resolves to `eslint . --fix`.
- There is also `pnpm typecheck` (`tsc --noEmit` against both `tsconfig.json` and
  `tsconfig.test.json`), not asked for above but available and not covered by `pnpm test`.

## Delivery

`@stonyx/logs` is published to npm (`@stonyx/logs`) and consumed as a library dependency inside a
Node.js backend. It has no web, iOS, or Android surface of its own — delivery is "install the
package into a Node.js process," not a deployable service or app.

## Dependencies

- **Runtime:** [chalk](https://www.npmjs.com/package/chalk) `^5.3.0` (ESM-only, which is why this
  package is itself `"type": "module"`). Chalk owns the actual ANSI color / terminal-capability
  logic — detecting color support, rendering the escape codes, `chalk.hex()`, etc. `@stonyx/logs`
  only owns two things on top of it: which chalk function a log *type* maps to (`Color`, see
  [the color-resolution area doc](areas/log-class-and-color.md)), and the console/file write path
  around that (see [the file-logging area doc](areas/file-logging.md)). If you are debugging
  whether a given color actually renders correctly in a given terminal, that correctness is proven
  by chalk's own test suite, not this repo's — this repo's tests only assert that the right chalk
  function was *selected and called*, not that its ANSI output renders a particular way on a
  particular terminal.
- **Dev:** `@types/node`, `@types/qunit`, `@types/sinon`, `eslint` + `eslint-plugin-node`, `qunit`,
  `sinon`, `tsx`, `typescript`. File I/O itself (`fs`, `os`, `url`, `path`) uses Node builtins only
  — no additional runtime dependency for that.

## Further reading

- [README](../README.md) — install, usage examples, full API/configuration reference
- [Release process](release.md)
