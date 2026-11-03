# File-logging path resolution and the write path

## File paths

- `path` options (global and per type) are resolved against the consumer's project root by
  `sanitizePath()`. The root is the part of this module's own directory before its `node_modules`
  segment (or before `src` when the module is not running from `node_modules`, e.g. in this repo's
  own tests). If neither segment is found it throws
  `Failed to locate your project's root directory.`
- File names support `{date}`, `{type}`, `{pid}` and `{hostname}` template variables, resolved at
  write time (see the README's [Dynamic File Names](../../README.md#dynamic-file-names) section for
  the full variable table and examples). Path traversal characters (`..`, `/`, `\`) are stripped
  from the resolved name after substitution.

## Write path

- All file I/O on the write path is asynchronous (`fs.promises` — `fsp.writeFile` /
  `fsp.appendFile`, selected by the `overwrite` flag). There is no synchronous `fs` call anywhere on
  this path; `test/write-path-test.ts` carries a static check that fails the suite if one is added.
- Directory creation is one `mkdir(path, { recursive: true })` per directory, deduplicated across
  concurrent and later writes through an instance-level `Map` (`directoryCache`), keyed on the
  resolved directory path. The cache is instance-scoped, not module-scoped: two `Log` instances
  pointing at the same directory each call `mkdir` once.
- A write that fails with `ENOENT` or `ENOTDIR` invalidates the cache entry for that directory and
  is retried exactly once (the directory may have been removed or replaced underneath a warm
  cache). Every other code — `EACCES`, `EPERM`, `EROFS`, etc. — rejects immediately with no retry,
  because a successful `mkdir` on an existing directory is a no-op that cannot repair a permission
  or mount fault.
- A failed write rejects the promise returned by the logging call; that rejection is the caller's
  only failure signal. No fallback log is written and no error is printed to the console. See the
  README's [File Write Failures](../../README.md#file-write-failures) section for the consumer-facing
  contract, including why a fire-and-forget call produces an unhandled promise rejection on a failed
  write.
