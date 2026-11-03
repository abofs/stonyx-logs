# Custom log type definitions via `defineType()`

`defineType(type, setting, options)` is the mechanism behind both the constructor's
`systemLogs`/`additionalLogs` options and any type added after construction:

1. It calls `Color#setLogColor(type, setting)`, which resolves `setting` to a chalk function (see
   [Color settings](log-class-and-color.md#color-settings)) and stores it under `type`.
2. If no convenience method already exists for `type`, it creates one
   (`createConvenienceMethod`) — a thin proxy that calls `logAction(type, content, logToFile,
   overwrite)` with the class's default-handling logic for `logToFile` and `overwrite`.
3. If an `options` object is given, every key is validated against the known `LogOptions` keys
   (`logToFileByDefault`, `logTimestamp`, `path`, `prefix`, `suffix`, `filename`,
   `additionalLogs`, `systemLogs`). An unknown key throws immediately, naming the offending key. A
   `path` value is sanitized the same way the global `path` option is. The validated object is
   stored in `typeOptions[type]` and consulted by `getOptionForType()` before falling back to the
   instance-wide option.

Two consequences worth calling out for consumers:

- Calling `defineType()` for a type that already has a convenience method (e.g. redefining `info`)
  replaces its color/options but does not create a second method — `createConvenienceMethod` only
  runs when the method is missing.
- `defineType()` is interchangeable with populating `additionalLogs` in the constructor: the
  constructor itself calls `defineType()` once per merged type. Calling it after construction is
  how a type gets type-specific `options` (prefix/suffix/path/filename/etc.) that the constructor's
  flat `systemLogs`/`additionalLogs` shape has no room for.

See the README's [Advanced Configuration](../../README.md#advanced-configuration) and
[`defineType()` params](../../README.md#definetype-params) sections for worked examples, including
passing a raw chalk function (`log.chalk().bold.red`) as `setting`.
