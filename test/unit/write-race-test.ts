import QUnit from 'qunit';
import sinon from 'sinon';
import fs from 'fs';
import { syncBuiltinESMExports } from 'module';
import { setTimeout as tick } from 'timers/promises';
import Log from '../../src/index.js';

const { module: qunitModule, test } = QUnit;

type DrainOrder = 'lifo' | 'fifo';
type AnyFn = (...args: any[]) => any;

interface VirtualFs {
  files: Map<string, string>;
  dirs: Set<string>;
  queue: Array<() => void>;
  mkdir: sinon.SinonStub;
  access: sinon.SinonStub;
  writeFile: sinon.SinonStub;
  appendFile: sinon.SinonStub;
  syncStubs: sinon.SinonStub[];
  failMkdir: (code: string | null) => void;
  drain: (order?: DrainOrder) => Promise<void>;
  content: (target: string) => string;
}

function fsError(code: string, syscall: string, target: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`${code}: ${syscall} '${target}'`);
  error.code = code;
  error.syscall = syscall;
  error.path = target;

  return error;
}

/*
 * Deterministic in-memory fs boundary. Real fsp ordering is decided by the libuv threadpool, so a
 * Promise.all of N log() calls against a real file is probabilistic and cannot be a regression test.
 * Here mkdir/writeFile/appendFile push their settle callback onto a queue that the test drains by
 * hand, which makes the adversarial interleaving reproducible (LIFO being the worst case).
 */
function installVirtualFs(): VirtualFs {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const queue: Array<() => void> = [];
  const promisesApi = fs.promises as unknown as Record<string, AnyFn>;
  const syncApi = fs as unknown as Record<string, AnyFn>;
  let mkdirFailCode: string | null = null;

  const dirOf = (target: string): string => target.slice(0, target.lastIndexOf('/') + 1);

  const fakeAsync = (name: string, impl: AnyFn): sinon.SinonStub => {
    const stub = sinon.stub(promisesApi, name);
    stub.callsFake(impl);

    return stub;
  };

  const writer = (defaultFlag: string): AnyFn => (target: string, data: unknown, opts?: unknown) =>
    new Promise<void>((resolve, reject) => {
      const options = opts as { flag?: string } | undefined;
      const flag = typeof options === 'object' && options !== null && options.flag ? options.flag : defaultFlag;

      queue.push(() => {
        if (!dirs.has(dirOf(target))) return reject(fsError('ENOENT', 'open', target));

        const existing = files.get(target) ?? '';

        files.set(target, flag.startsWith('a') ? `${existing}${String(data)}` : String(data));

        return resolve();
      });
    });

  const mkdir = fakeAsync('mkdir', (target: string) => new Promise<void>((resolve, reject) => {
    queue.push(() => {
      if (mkdirFailCode) return reject(fsError(mkdirFailCode, 'mkdir', target));

      dirs.add(target);

      return resolve();
    });
  }));

  const access = fakeAsync('access', (target: string) => (files.has(target) || dirs.has(target)
    ? Promise.resolve()
    : Promise.reject(fsError('ENOENT', 'access', target))));

  const writeFile = fakeAsync('writeFile', writer('w'));
  const appendFile = fakeAsync('appendFile', writer('a'));

  /*
   * `import { mkdirSync } from 'fs'` is a static builtin-ESM binding, so sinon.stub(fs, 'mkdirSync')
   * records nothing until syncBuiltinESMExports() re-exports the patched value. Without this the
   * "no synchronous fs call" assertion would pass vacuously.
   */
  const syncStubs = ['mkdirSync', 'accessSync', 'writeFileSync', 'appendFileSync'].map(name => {
    const stub = sinon.stub(syncApi, name);
    stub.callsFake((target: string) => {
      if (name === 'mkdirSync') dirs.add(String(target));

      return undefined;
    });

    return stub;
  });

  syncBuiltinESMExports();

  const drain = async (order: DrainOrder = 'fifo'): Promise<void> => {
    for (let guard = 0; guard < 2000; guard++) {
      if (!queue.length) {
        await tick(0);

        if (!queue.length) return;
      }

      const op = order === 'lifo' ? queue.pop() : queue.shift();

      if (op) op();

      await tick(0);
    }

    throw new Error('virtual fs queue never reached quiescence');
  };

  return {
    files,
    dirs,
    queue,
    mkdir,
    access,
    writeFile,
    appendFile,
    syncStubs,
    failMkdir: (code: string | null) => { mkdirFailCode = code; },
    drain,
    content: (target: string) => files.get(target) ?? '',
  };
}

async function settle(
  vfs: VirtualFs,
  promises: Array<Promise<unknown>>,
  order: DrainOrder = 'fifo',
): Promise<Array<PromiseSettledResult<unknown>>> {
  const results = Promise.allSettled(promises);

  await vfs.drain(order);

  return results;
}

function target(log: Log, name: string): string {
  return `${log.options.path}${name}`;
}

function notices(stub: sinon.SinonStub): Array<Record<string, any>> {
  return stub.getCalls().map(call => {
    try {
      return JSON.parse(String(call.args[0])) as Record<string, any>;
    } catch {
      return { raw: call.args[0] } as Record<string, any>;
    }
  });
}

qunitModule('[Unit] write path race + mkdir caching', function (hooks) {
  let vfs: VirtualFs;
  let consoleLog: sinon.SinonStub;
  let consoleError: sinon.SinonStub;

  hooks.beforeEach(function () {
    consoleLog = sinon.stub(console, 'log');
    consoleError = sinon.stub(console, 'error');
    sinon.stub(console, 'dir');
    vfs = installVirtualFs();
  });

  hooks.afterEach(function () {
    sinon.restore();
    syncBuiltinESMExports();
  });

  // --- Group A: concurrency ---

  test('assertion 1 - LIFO drain, three concurrent first-writes retain every line', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });
    const writes = [1, 2, 3].map(n => log.writeToFile('info', `LINE${n}\n`, false));

    await settle(vfs, writes, 'lifo');

    const content = vfs.content(target(log, 'info.log'));

    assert.ok(content.includes('LINE1'), `LINE1 retained (content: ${JSON.stringify(content)})`);
    assert.ok(content.includes('LINE2'), `LINE2 retained (content: ${JSON.stringify(content)})`);
    assert.ok(content.includes('LINE3'), `LINE3 retained (content: ${JSON.stringify(content)})`);
    assert.strictEqual(vfs.mkdir.callCount, 1, 'concurrent first-writes dedupe onto a single mkdir');
  });

  test('assertion 2 - FIFO drain, three concurrent first-writes retain every line', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });
    const writes = [1, 2, 3].map(n => log.writeToFile('info', `LINE${n}\n`, false));

    await settle(vfs, writes, 'fifo');

    const content = vfs.content(target(log, 'info.log'));

    assert.ok(content.includes('LINE1'), 'LINE1 retained');
    assert.ok(content.includes('LINE2'), 'LINE2 retained');
    assert.ok(content.includes('LINE3'), 'LINE3 retained');
  });

  test('assertion 3 - serial control, two awaited writes produce exactly the two lines', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });

    await settle(vfs, [log.writeToFile('info', 'A\n', false)]);
    await settle(vfs, [log.writeToFile('info', 'B\n', false)]);

    assert.strictEqual(vfs.content(target(log, 'info.log')), 'A\nB\n', 'no bootstrap write, no dropped line');
  });

  /*
   * Regression guard for the flag-before-await ordering bug (implementation note 5): the cache must
   * hold the in-flight mkdir *promise*, never a boolean/Set entry set before the await.
   *
   * The content assertions above cannot see that bug - under a Set flag the LIFO drain still pops
   * mkdir first, and the ENOENT self-heal retry rescues any append that did land early, so the
   * final bytes are identical either way. This asserts the invariant directly instead: the mkdir is
   * held pending (its settle callback is parked in the virtual queue and never drained here), and
   * every concurrent writer must still be blocked on it, with zero appends attempted.
   */
  test('assertion 17 - concurrent first-writes stay blocked until the pending mkdir settles', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });
    const writes = [1, 2, 3].map(n => log.writeToFile('info', `LINE${n}\n`, false));

    // let every writer run to its first real suspension point without settling the pending mkdir
    for (let hop = 0; hop < 25; hop++) await tick(0);

    assert.strictEqual(vfs.mkdir.callCount, 1, 'exactly one mkdir is in flight');
    assert.strictEqual(vfs.appendFile.callCount, 0, 'no append is attempted while mkdir is pending');
    assert.strictEqual(vfs.writeFile.callCount, 0, 'no write is attempted while mkdir is pending');
    assert.strictEqual(vfs.queue.length, 1, 'the pending mkdir is the only queued fs operation');
    assert.notOk(vfs.dirs.has(log.options.path), 'precondition: the directory does not exist yet');

    await settle(vfs, writes, 'lifo');

    const content = vfs.content(target(log, 'info.log'));

    assert.ok(content.includes('LINE1'), `LINE1 retained (content: ${JSON.stringify(content)})`);
    assert.ok(content.includes('LINE2'), `LINE2 retained (content: ${JSON.stringify(content)})`);
    assert.ok(content.includes('LINE3'), `LINE3 retained (content: ${JSON.stringify(content)})`);
    assert.strictEqual(vfs.mkdir.callCount, 1, 'no writer needed a self-heal retry');
  });

  // --- Group B: mkdir caching ---

  test('assertions 4 + 5 - repeat writes call mkdir once and never skip the payload write', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });

    for (let i = 0; i < 5; i++) {
      await settle(vfs, [log.writeToFile('info', `x${i}\n`, false)]);
    }

    assert.strictEqual(vfs.mkdir.callCount, 1, 'mkdir called exactly once for five writes');
    assert.strictEqual(vfs.appendFile.callCount, 5, 'every write still reached appendFile');
    assert.strictEqual(vfs.content(target(log, 'info.log')), 'x0\nx1\nx2\nx3\nx4\n', 'all payloads landed in order');
  });

  test('assertion 6 - mkdir is called with the configured directory and recursive: true', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });

    await settle(vfs, [log.writeToFile('info', 'x\n', false)]);

    assert.deepEqual(vfs.mkdir.firstCall.args, [log.options.path, { recursive: true }], 'mkdir args');
  });

  test('assertion 7 - no synchronous fs call remains on the repeat-write path', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });

    await settle(vfs, [log.writeToFile('info', 'a\n', false)]);
    await settle(vfs, [log.writeToFile('info', 'b\n', false)]);
    await settle(vfs, [log.writeToFile('info', 'c\n', false)]);

    const syncCallCount = vfs.syncStubs.reduce((total, stub) => total + stub.callCount, 0);

    assert.strictEqual(syncCallCount, 0, 'no mkdirSync/accessSync/writeFileSync/appendFileSync calls');
    assert.strictEqual(vfs.access.callCount, 0, 'the access + bootstrap-writeFile dance is gone');
  });

  test('assertion 8 - two targets in one directory share a single mkdir', async function (assert) {
    const log = new Log({
      path: 'virtual-logs',
      systemLogs: {
        alpha: 'red',
        beta: 'blue',
      },
    });

    log.defineType('alpha', 'red', { filename: 'alpha-{type}.log' });
    log.defineType('beta', 'blue', { filename: 'beta-{type}.log' });

    await settle(vfs, [log.writeToFile('alpha', 'A\n', false)]);
    await settle(vfs, [log.writeToFile('beta', 'B\n', false)]);

    assert.strictEqual(vfs.mkdir.callCount, 1, 'directory-keyed cache is not invalidated by a new filename');
    assert.strictEqual(vfs.content(target(log, 'alpha-alpha.log')), 'A\n', 'alpha target');
    assert.strictEqual(vfs.content(target(log, 'beta-beta.log')), 'B\n', 'beta target');
  });

  test('assertion 9 - {date} rollover writes zero lines into the previous day file', async function (assert) {
    const clock = sinon.useFakeTimers({
      toFake: ['Date'],
      now: new Date('2026-08-29T23:59:00Z').getTime(),
    });
    const log = new Log({
      path: 'virtual-logs',
      filename: '{date}.log',
    });

    const first = log.resolveFilename('{date}.log', 'info');

    await settle(vfs, [log.writeToFile('info', 'DAY1\n', false)]);

    clock.tick(86_400_000);

    const second = log.resolveFilename('{date}.log', 'info');

    await settle(vfs, [log.writeToFile('info', 'DAY2\n', false)]);

    clock.restore();

    assert.notStrictEqual(first, second, 'rollover produced a distinct target');
    assert.strictEqual(vfs.content(target(log, second)), 'DAY2\n', 'day two line landed in the new file');
    assert.notOk(vfs.content(target(log, first)).includes('DAY2'), 'zero lines written into the previous day file');
    assert.strictEqual(vfs.mkdir.callCount, 1, 'rollover does not invalidate the directory cache');
  });

  // --- Group C: overwrite path is untouched ---

  test('assertion 10 - overwrite truncates an existing target and carries no append flag', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });

    await settle(vfs, [log.writeToFile('info', 'OLD\n', false)]);

    assert.strictEqual(vfs.content(target(log, 'info.log')), 'OLD\n', 'precondition');

    await settle(vfs, [log.writeToFile('info', 'PAYLOAD\n', true)]);

    const flag = (vfs.writeFile.firstCall.args[2] as { flag?: string } | undefined)?.flag;

    assert.strictEqual(vfs.content(target(log, 'info.log')), 'PAYLOAD\n', 'overwrite still truncates');
    assert.notOk(flag === 'a' || flag === 'ax', 'no append flag leaked into the payload write');
  });

  test('assertion 11 - overwrite at a fresh target writes the payload exactly once', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });

    await settle(vfs, [log.writeToFile('info', 'PAYLOAD\n', true)]);

    /*
     * Content equality alone cannot see a double write: two writeFile calls with identical payload
     * under the truncating 'w' flag are byte-indistinguishable from one. The call count can.
     */
    assert.strictEqual(vfs.content(target(log, 'info.log')), 'PAYLOAD\n', 'no empty bootstrap, no double write');
    assert.strictEqual(vfs.writeFile.callCount, 1, 'payload written exactly once');
    assert.strictEqual(vfs.appendFile.callCount, 0, 'overwrite path never appends');
  });

  // --- Group D: failure path (#29) ---

  test('assertion 13 - one failed write emits at most two console lines', async function (assert) {
    const log = new Log({
      path: 'virtual-logs',
      logToFileByDefault: true,
    });
    const writeSpy = sinon.spy(log, 'writeToFile');

    vfs.failMkdir('EACCES');

    const [result] = await settle(vfs, [log.error('boom')]);

    await tick(20);

    const emissions = consoleLog.callCount + consoleError.callCount;

    assert.strictEqual(result.status, 'rejected', 'the failure surfaces as a rejection');
    assert.strictEqual(writeSpy.callCount, 1, 'the failure path never re-enters writeToFile');
    assert.ok(emissions <= 2, `console emissions <= 2 (actual: ${emissions})`);
  });

  test('assertion 14 - a write failure with this.error undefined throws no TypeError', async function (assert) {
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown): void => { rejections.push(reason); };

    process.on('unhandledRejection', onUnhandled);

    const log = new Log({
      path: 'virtual-logs',
      logToFileByDefault: true,
      systemLogs: { test: 'red' },
    });

    assert.strictEqual(log.error, undefined, 'precondition: this.error is undefined');

    vfs.failMkdir('EACCES');

    const [result] = await settle(vfs, [log.writeToFile('test', 'x\n', false)]);

    await tick(20);

    process.off('unhandledRejection', onUnhandled);

    const reason = result.status === 'rejected' ? result.reason as NodeJS.ErrnoException : null;

    assert.strictEqual(result.status, 'rejected', 'writeToFile rejects');
    assert.notOk(reason instanceof TypeError, 'rejection is not a TypeError');
    assert.strictEqual(reason?.code, 'EACCES', 'rejection preserves err.code');
    assert.strictEqual(rejections.length, 0, 'no unhandled rejection');
  });

  test('assertion 15 - N failures emit once, first success emits one recovery with suppressedCount', async function (assert) {
    const log = new Log({ path: 'virtual-logs' });

    vfs.failMkdir('EACCES');

    for (let i = 0; i < 4; i++) {
      const [result] = await settle(vfs, [log.writeToFile('info', `f${i}\n`, false)]);

      assert.strictEqual(result.status, 'rejected', `write ${i} rejected`);

      /*
       * Pins the "retry exactly once" bound that mitigates refinement risk (b). Each failed write
       * costs the initial attempt plus one retry and nothing more, so the cumulative count grows
       * by exactly 2 per write - a wider retry ladder makes this go red instead of hiding behind
       * the deduped notice.
       */
      assert.strictEqual(vfs.mkdir.callCount, (i + 1) * 2, `write ${i} retried exactly once`);
    }

    assert.strictEqual(consoleError.callCount, 1, 'four consecutive failures produce exactly one emit');

    vfs.failMkdir(null);

    await settle(vfs, [log.writeToFile('info', 'ok\n', false)]);

    const emitted = notices(consoleError);

    assert.strictEqual(consoleError.callCount, 2, 'the first success adds exactly one recovery emit');
    assert.strictEqual(emitted[0].severity, 'error', 'failure notice severity');
    assert.strictEqual(emitted[0].event, 'log-write-failed', 'failure notice event');
    assert.strictEqual(emitted[0].surface, 'stonyx-logs', 'failure notice surface');
    assert.strictEqual(emitted[0].payload.code, 'EACCES', 'failure notice carries the fs code');
    assert.strictEqual(emitted[0].payload.syscall, 'mkdir', 'failure notice carries the syscall');
    assert.strictEqual(emitted[0].payload.suppressedCount, 0, 'first failure suppressed nothing');
    assert.strictEqual(emitted[1].severity, 'warn', 'recovery notice severity');
    assert.strictEqual(emitted[1].event, 'log-write-recovered', 'recovery notice event');
    assert.strictEqual(emitted[1].payload.suppressedCount, 3, 'recovery reports N-1 suppressed failures');
    assert.strictEqual(vfs.content(target(log, 'info.log')), 'ok\n', 'the recovered write landed');
  });
});
