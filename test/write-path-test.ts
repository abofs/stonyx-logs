import QUnit from 'qunit';
import sinon from 'sinon';
import { promises as fsp } from 'fs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import Log from '../src/index.js';

const { module, test } = QUnit;

/*
 * Coverage for abofs/stonyx-logs#28 — truncation race on first write, and the
 * blocking mkdirSync that ran on every writeToFile() call.
 *
 * Each acceptance criterion from the issue has a test below.
 */

type WriteFile = typeof fsp.writeFile;

const createdPaths: string[] = [];
let dirCounter = 0;

// unique relative directory per test so trials never share a cache key or a file
function uniquePath(label: string): string {
  dirCounter += 1;

  return `.tmp-write-path-logs/${label}-${process.pid}-${dirCounter}/`;
}

function createLog(relativePath: string, options: Record<string, unknown> = {}): Log {
  const log = new Log({
    path: relativePath,
    systemLogs: { t: 'green' },
    ...options,
  });
  createdPaths.push(log.options.path);

  return log;
}

async function readLines(target: string): Promise<string[]> {
  const raw = await fsp.readFile(target, 'utf8').catch(() => '');

  return raw.split('\n').filter(line => line.length > 0);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, ms); });
}

module('[Integration] write path (#28)', function(hooks) {
  hooks.beforeEach(function() {
    sinon.stub(console, 'log');
  });

  hooks.afterEach(async function() {
    sinon.restore();

    for (const path of createdPaths) {
      const root = path.split('/.tmp-write-path-logs/')[0];

      await fsp.rm(`${root}/.tmp-write-path-logs`, {
        recursive: true,
        force: true,
      }).catch(() => undefined);
    }

    createdPaths.length = 0;
  });

  // --- AC1: concurrent first-writes retain all appended content ---

  module('AC1 truncation race', function() {
    test('an in-flight bootstrap write cannot truncate a completed append', async function(assert) {
      /*
       * Deterministic form of the race: any zero-length payload write (the
       * bootstrap `writeFile(target, '')`) is delayed so that it is guaranteed
       * to land after every append has resolved. If the write path still emits
       * a bootstrap write that outlives the awaited validate call, the file is
       * emptied.
       */
      const realWriteFile: WriteFile = fsp.writeFile.bind(fsp);
      sinon.stub(fsp, 'writeFile').callsFake((async (
        target: Parameters<WriteFile>[0],
        content: Parameters<WriteFile>[1],
        options?: Parameters<WriteFile>[2],
      ) => {
        if (content === '') await delay(50);

        return realWriteFile(target, content, options);
      }) as unknown as WriteFile);

      const log = createLog(uniquePath('ac1-deterministic'));
      const target = `${log.options.path}t.log`;

      await Promise.all(
        Array.from({ length: 5 }, (_unused, index) => log.writeToFile('t', `line-${index}\n`, false)),
      );

      // give any fire-and-forget bootstrap write time to land
      await delay(150);

      const lines = await readLines(target);

      assert.strictEqual(lines.length, 5, 'all 5 appended lines survived the bootstrap write');
    });

    test('concurrent first-writes to a non-existent log retain every line', async function(assert) {
      const trials = 20;
      const concurrency = 10;
      const lost: number[] = [];

      for (let trial = 0; trial < trials; trial++) {
        const log = createLog(uniquePath('ac1-stress'));
        const target = `${log.options.path}t.log`;

        await Promise.all(
          Array.from({ length: concurrency }, (_unused, index) => log.writeToFile('t', `line-${index}\n`, false)),
        );

        const lines = await readLines(target);

        if (lines.length !== concurrency) lost.push(concurrency - lines.length);
      }

      assert.deepEqual(lost, [], `no lines lost across ${trials} trials of ${concurrency} concurrent first-writes`);
    });
  });

  // --- AC2: repeat writes invoke mkdir once, no sync fs on the repeat path ---

  module('AC2 directory cache', function() {
    test('repeat writes to the same directory invoke mkdir exactly once', async function(assert) {
      const mkdirSpy = sinon.spy(fsp, 'mkdir');
      const log = createLog(uniquePath('ac2-cache'));
      const target = `${log.options.path}t.log`;

      for (let index = 0; index < 5; index++) {
        await log.writeToFile('t', `line-${index}\n`, false);
      }

      const lines = await readLines(target);

      assert.strictEqual(mkdirSpy.callCount, 1, 'mkdir invoked exactly once across 5 writes');
      assert.strictEqual(lines.length, 5, 'all 5 lines landed');
    });

    test('concurrent cold writes dedupe onto a single mkdir', async function(assert) {
      const mkdirSpy = sinon.spy(fsp, 'mkdir');
      const log = createLog(uniquePath('ac2-dedupe'));
      const target = `${log.options.path}t.log`;

      await Promise.all(
        Array.from({ length: 8 }, (_unused, index) => log.writeToFile('t', `line-${index}\n`, false)),
      );

      const lines = await readLines(target);

      assert.strictEqual(mkdirSpy.callCount, 1, 'concurrent first-writes share one mkdir syscall');
      assert.strictEqual(lines.length, 8, 'all 8 lines landed');
    });

    test('no synchronous fs call remains on the write path', function(assert) {
      /*
       * Static check: an ESM named import binding (`import { mkdirSync } from
       * 'fs'`) cannot be patched at runtime from the importing side, so the
       * absence of a blocking call is asserted against the source itself.
       */
      const source = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');
      const syncCalls = source.match(/\w+Sync\(/g) ?? [];

      assert.deepEqual(syncCalls, [], 'src/index.ts contains no synchronous fs call');
    });
  });

  // --- AC3: per-target writes share the directory cache ---

  module('AC3 per-target routing', function() {
    test('a different target in the same directory does not re-validate', async function(assert) {
      const mkdirSpy = sinon.spy(fsp, 'mkdir');
      const path = uniquePath('ac3-targets');
      const log = createLog(path);
      log.defineType('alpha', 'green', {
        path,
        filename: 'alpha.log',
      });
      log.defineType('beta', 'blue', {
        path,
        filename: 'beta.log',
      });

      await log.writeToFile('alpha', 'alpha-line\n', false);
      await log.writeToFile('beta', 'beta-line\n', false);
      await log.writeToFile('alpha', 'alpha-line-2\n', false);

      const alphaLines = await readLines(`${log.options.path}alpha.log`);
      const betaLines = await readLines(`${log.options.path}beta.log`);

      assert.strictEqual(mkdirSpy.callCount, 1, 'directory validated once for both targets');
      assert.deepEqual(alphaLines, ['alpha-line', 'alpha-line-2'], 'alpha target holds only alpha content');
      assert.deepEqual(betaLines, ['beta-line'], 'beta target holds only beta content');
    });

    test('{date} rollover writes to the new file with zero writes into the previous day', async function(assert) {
      const beforeMidnight = new Date(2026, 0, 1, 23, 59, 50);
      const afterMidnight = new Date(2026, 0, 2, 0, 0, 10);
      const mkdirSpy = sinon.spy(fsp, 'mkdir');
      const path = uniquePath('ac3-rollover');
      const log = createLog(path, { filename: '{date}.log' });
      const clock = sinon.useFakeTimers({
        now: beforeMidnight,
        toFake: ['Date'],
      });

      await log.writeToFile('t', 'day-one\n', false);
      clock.setSystemTime(afterMidnight);
      await log.writeToFile('t', 'day-two\n', false);
      clock.restore();

      const dayOne = await readLines(`${log.options.path}2026-01-01.log`);
      const dayTwo = await readLines(`${log.options.path}2026-01-02.log`);

      assert.strictEqual(mkdirSpy.callCount, 1, 'date rollover does not re-validate the directory');
      assert.deepEqual(dayOne, ['day-one'], 'previous day file received zero post-rollover writes');
      assert.deepEqual(dayTwo, ['day-two'], 'post-rollover write landed in the new day file');
    });
  });

  // --- AC4: overwrite path still truncates ---

  module('AC4 overwrite semantics', function() {
    test('overwrite: true truncates and no append flag leaks into the payload write', async function(assert) {
      const writeFileSpy = sinon.spy(fsp, 'writeFile');
      const log = createLog(uniquePath('ac4-overwrite'));
      const target = `${log.options.path}t.log`;

      await log.writeToFile('t', 'first\n', true);
      await log.writeToFile('t', 'second\n', true);

      const lines = await readLines(target);
      const payloadCalls = writeFileSpy.getCalls().filter(call => call.args[1] !== '');
      const optionsArgs = payloadCalls.map(call => call.args[2]);

      assert.deepEqual(lines, ['second'], 'second overwrite truncated the first');
      assert.strictEqual(payloadCalls.length, 2, 'both payload writes used writeFile');
      assert.deepEqual(optionsArgs, [undefined, undefined], 'no flag option passed to the payload write');
    });
  });

  // --- AC5: self-healing after runtime directory removal ---

  module('AC5 cache self-heal', function() {
    test('directory removed on a warm cache is recreated, line lands, mkdir called twice', async function(assert) {
      const mkdirSpy = sinon.spy(fsp, 'mkdir');
      const log = createLog(uniquePath('ac5-selfheal'));
      const target = `${log.options.path}t.log`;

      await log.writeToFile('t', 'before\n', false);

      // remove the directory out from under a warm cache
      await fsp.rm(log.options.path, {
        recursive: true,
        force: true,
      });

      await log.writeToFile('t', 'after\n', false);

      const lines = await readLines(target);

      assert.deepEqual(lines, ['after'], 'the post-removal line landed in a recreated directory');
      assert.strictEqual(mkdirSpy.callCount, 2, 'mkdir called exactly twice across the test');
    });

    /*
     * validateFileAndDirectory() is awaited OUTSIDE the try in writeToFile(), so a
     * rejected promise left in the cache is returned by every later call and propagates
     * straight past the retry logic. Without the pending.catch() eviction a single
     * transient mkdir failure permanently bricks every future write to that directory
     * for the life of the Log instance.
     */
    test('a transient mkdir failure is not cached: the next write recovers', async function(assert) {
      const log = createLog(uniquePath('mkdir-poison'));
      const target = `${log.options.path}t.log`;
      const realMkdir = fsp.mkdir.bind(fsp);
      let failedOnce = false;

      const mkdirStub = sinon.stub(fsp, 'mkdir').callsFake(((...args: unknown[]) => {
        if (!failedOnce) {
          failedOnce = true;

          return Promise.reject(Object.assign(new Error('transient'), { code: 'EAGAIN' }));
        }

        return (realMkdir as unknown as (...a: unknown[]) => Promise<unknown>)(...args);
      }) as never);

      let firstCode: string | undefined;

      try {
        await log.writeToFile('t', 'first\n', false);
      } catch (error) {
        firstCode = (error as NodeJS.ErrnoException).code;
      }

      assert.strictEqual(firstCode, 'EAGAIN', 'the transient mkdir failure reaches the caller');
      assert.strictEqual(
        log.directoryCache.has(log.options.path),
        false,
        'the rejected promise was evicted rather than cached',
      );

      await log.writeToFile('t', 'second\n', false);

      assert.deepEqual(await readLines(target), ['second'], 'the next write recovers and lands');
      assert.strictEqual(mkdirStub.callCount, 2, 'mkdir ran exactly once more after the failure');
    });
  });

  // --- Error contract: rejection is the only failure signal ---

  module('error contract', function() {
    test('writeToFile rejects with the underlying fs error and does not retry a non-recoverable failure', async function(assert) {
      const mkdirSpy = sinon.spy(fsp, 'mkdir');
      const log = createLog(uniquePath('err-contract'));
      const target = `${log.options.path}t.log`;

      // occupy the target path with a directory so the payload write fails EISDIR
      await fsp.mkdir(target, { recursive: true });
      mkdirSpy.resetHistory();

      let code: string | undefined;

      try {
        await log.writeToFile('t', 'content\n', false);
      } catch (error) {
        code = (error as NodeJS.ErrnoException).code;
      }

      assert.strictEqual(code, 'EISDIR', 'rejection preserves the underlying fs error code');
      assert.strictEqual(mkdirSpy.callCount, 1, 'a non-recoverable failure is not retried');
    });

    /*
     * A permission fault is not repairable by mkdir(recursive) — it is a successful
     * no-op on an existing directory. Retrying it doubles the syscalls on every write
     * forever and defeats the one-mkdir-per-directory invariant. Pin the counts.
     */
    test('a permission fault is not retried and does not defeat the mkdir-once invariant', async function(assert) {
      const log = createLog(uniquePath('eacces-noretry'));

      // create the directory, then drop write permission so each payload write fails EACCES
      await fsp.mkdir(log.options.path, { recursive: true });
      await fsp.chmod(log.options.path, 0o500);

      const mkdirSpy = sinon.spy(fsp, 'mkdir');
      const appendSpy = sinon.spy(fsp, 'appendFile');
      const codes: string[] = [];

      for (let i = 0; i < 5; i += 1) {
        try {
          await log.writeToFile('t', `line-${i}\n`, false);
        } catch (error) {
          codes.push((error as NodeJS.ErrnoException).code as string);
        }
      }

      // restore permissions so the afterEach cleanup can remove the tree
      await fsp.chmod(log.options.path, 0o755);

      assert.deepEqual(
        codes,
        ['EACCES', 'EACCES', 'EACCES', 'EACCES', 'EACCES'],
        'every write rejects with the underlying EACCES',
      );
      assert.strictEqual(mkdirSpy.callCount, 1, 'mkdir runs once for the cold cache and is never retried');
      assert.strictEqual(appendSpy.callCount, 5, 'each failing write attempts exactly one append');
      assert.strictEqual(
        log.directoryCache.has(log.options.path),
        true,
        'a permission fault leaves the directory cache intact',
      );
    });
  });
});
