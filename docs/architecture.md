# Architecture

`@stonyx/logs` is two source files with one runtime dependency, [chalk](https://www.npmjs.com/package/chalk) 5 (ESM-only, which is why the package is `"type": "module"`). File I/O uses Node built-ins only.

## Classes

| Class | Source | Import | Role |
|---|---|---|---|
| `Log` | `src/index.ts` | `@stonyx/logs` (default export) | Builds the log types, generates the convenience methods, writes to console and file |
| `Color` | `src/color.ts` | `@stonyx/logs/color` (default export) | Turns a color setting into a chalk function. `Log` delegates all color resolution to it |

## Log types and convenience methods

- The constructor merges `systemLogs` (defaults `info: cyan`, `warn: yellow`, `error: red`) with `additionalLogs`, then attaches one method per type to the instance (`log.info()`, `log.warn()`, ...).
- `defineType(type, setting, options)` registers or replaces a type after construction. Its `options` are stored per type in `typeOptions`.
- Option lookup for a type reads `typeOptions[type][option]` and falls back to the global option when that value is missing or falsy.
- `debug()` is defined separately from the generated methods. It writes to the console with `console.dir(content, { depth: 6 })` and to file with `JSON.stringify(content, null, 2)`.

## Color settings

`Color#settingToChalkColorFunction()` accepts:

- a string starting with `#`, resolved with `chalk.hex()`;
- any other string, resolved as a named chalk method (`red`, `magentaBright`, ...);
- a function, used as is.

In every case the resolved function is called once with `''` and must return a string. Anything else throws `Invalid chalk color function`, so a bad setting fails when the type is defined rather than when it first logs.

## File paths

- `path` options (global and per type) are resolved against the consumer's project root by `sanitizePath()`. The root is the part of this module's own directory before its `node_modules` segment (or before `src` when the module is not under `node_modules`). If neither segment is found it throws `Failed to locate your project's root directory.`
- File names support `{date}`, `{type}`, `{pid}` and `{hostname}`; path traversal characters are stripped after substitution (see the README's Dynamic File Names section).

## Write path

- All file I/O on the write path is asynchronous (`fs.promises`). Directory creation is one `mkdir(path, { recursive: true })` per directory, shared by concurrent and later writes through an instance-level promise cache.
- No synchronous fs call may appear in `src/index.ts`. `test/write-path-test.ts` carries a static check that fails if one is added.
- A failed write rejects the promise returned by the logging call; that rejection is the caller's only failure signal (README: File Write Failures).
