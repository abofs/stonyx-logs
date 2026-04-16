import Qunit from 'qunit';
import Log from '../src/index.js';
import { fileURLToPath } from 'url';
import projectPath from 'path';
import { type ChalkColorFn } from '../src/color.js';

const { module, test } = Qunit;

module('[Unit] Log Tests', function() {
  test('Path is sanitized correctly', function(assert) {
    const log = new Log({ path: 'test' });
    const expectedPath = `${projectPath.dirname(fileURLToPath(import.meta.url))}/`;

    assert.equal(log.options.path, expectedPath);
  });

  test('Chalk advance settings can be configured', function(assert) {
    const log = new Log();
    const { settingToChalkColorFunction } = log.color;

    const chalkAdvanced1 = log.chalk().blue.bgRed.bold as unknown as ChalkColorFn;
    const chalkAdvanced2 = log.chalk().bold.red as unknown as ChalkColorFn;
    const chalkAdvanced3 = log.chalk().bgCyan.white as unknown as ChalkColorFn;
    const chalkColors: ChalkColorFn[] = [];

    try {
      chalkColors.push(...[
        settingToChalkColorFunction.call(log.color, 'red'),
        settingToChalkColorFunction.call(log.color, 'blue'),
        settingToChalkColorFunction.call(log.color, 'gray'),
        settingToChalkColorFunction.call(log.color, 'grey'), // alias
        settingToChalkColorFunction.call(log.color, 'white'),
        settingToChalkColorFunction.call(log.color, '#fff'),
        settingToChalkColorFunction.call(log.color, '#c0c0c0'),
        settingToChalkColorFunction.call(log.color, '#ff0000'),
        settingToChalkColorFunction.call(log.color, chalkAdvanced1),
        settingToChalkColorFunction.call(log.color, chalkAdvanced2),
        settingToChalkColorFunction.call(log.color, chalkAdvanced3),
      ]);
    } catch (error) {
      assert.throws(() => { throw error; });
    }

    const actualTypes = chalkColors.map(c => typeof c);
    const expectedTypes = chalkColors.map(() => 'function');

    assert.deepEqual(actualTypes, expectedTypes, 'chalk colors are proper functions');
  });

  test('Log colors are correctly set', function(assert) {
    const log = new Log({ systemLogs: {} });

    try {
      log.color.setLogColor('test1', 'red');
      log.color.setLogColor('test2', 'white');
      log.color.setLogColor('test3', 'blue');
    } catch (error) {
      assert.throws(() => { throw error; });
    }

    const expectedKeys = ['test1', 'test2', 'test3'];

    assert.deepEqual(Object.keys(log.color.types), expectedKeys, 'configured color keys');
  });
});
