# The `Log` class and color resolution

> The internal class is named `Log` (not `Logs`, `Logger`, etc.). There is an open rename-tracking
> issue, [abofs/stonyx-logs#11](https://github.com/abofs/stonyx-logs/issues/11), but no rename has
> landed; this document uses the name as it exists in `src/index.ts` today.

## Classes

| Class | Source | Import | Role |
|---|---|---|---|
| `Log` | `src/index.ts` | `@stonyx/logs` (default export) | Builds the log types, generates the convenience methods, writes to console and file |
| `Color` | `src/color.ts` | `@stonyx/logs/color` (default export) | Turns a color setting into a chalk function. `Log` delegates all color resolution to it |

## Log types and convenience methods

- The constructor merges `systemLogs` (defaults `info: cyan`, `warn: yellow`, `error: red`) with
  `additionalLogs`, then attaches one method per type to the instance (`log.info()`, `log.warn()`,
  ...) via `defineType()`.
- `defineType(type, setting, options)` registers or replaces a type after construction (see
  [Custom log type definitions](custom-types.md) for the full mechanics). Its `options` are stored
  per type in `typeOptions`.
- Option lookup for a type (`getOptionForType`) reads `typeOptions[type][option]` and falls back to
  the global option (`this.options[option]`) when that value is missing or falsy.
- `debug()` is defined separately from the generated methods. It writes to the console with
  `console.dir(content, { depth: 6 })` and to file with `JSON.stringify(content, null, 2)`. Unlike
  the other types it defaults `overwrite` to `true`.

## Color settings

`Color#settingToChalkColorFunction()` accepts:

- a string starting with `#`, resolved with `chalk.hex()`;
- any other string, resolved as a named chalk method (`red`, `magentaBright`, ...);
- a function, used as-is.

In every case the resolved function is called once with `''` and must return a string. Anything
else throws `Invalid chalk color function`, so a bad setting fails when the type is defined rather
than when it first logs.

`Log` exposes the underlying chalk instance via `log.chalk()` (`Color#getChalkInstance()`) so
callers can build advanced chalk functions (e.g. `log.chalk().bold.red`) without importing chalk
directly — see [Dependencies](../index.md#dependencies) for what `@stonyx/logs` does and does not
own here.
