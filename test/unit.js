import Qunit from 'qunit';
import Chronicle from '../src/index.js';
import { fileURLToPath } from 'url';
import projectPath from 'path';

const { module, test } = Qunit;

module('[Unit] Chronicle Tests', function() {
    test('Path is sanitized correctly', function(assert) {
      const chronicle = new Chronicle({ path: 'test' });
      const expectedPath = `${projectPath.dirname(fileURLToPath(import.meta.url))}/`;
  
      assert.equal(chronicle.options.path, expectedPath);
    });

    test('Chalk advance settings can be configured', function(assert) {
        const chronicle = new Chronicle();
        const { settingToChalkColorFunction } = chronicle.color;

        const chalkAdvanced1 = chronicle.chalk().blue.bgRed.bold;
        const chalkAdvanced2 = chronicle.chalk().bold.red;
        const chalkAdvanced3 = chronicle.chalk().bgCyan.white;
        const chalkColors = [];
        
        try {
            chalkColors.push(...[
                settingToChalkColorFunction('red'),
                settingToChalkColorFunction('blue'),
                settingToChalkColorFunction('gray'),
                settingToChalkColorFunction('grey'), // alias
                settingToChalkColorFunction('white'),
                settingToChalkColorFunction('#fff'),
                settingToChalkColorFunction('#c0c0c0'),
                settingToChalkColorFunction('#ff0000'),
                settingToChalkColorFunction(chalkAdvanced1),
                settingToChalkColorFunction(chalkAdvanced2),
                settingToChalkColorFunction(chalkAdvanced3),
            ]);
        } catch { error => {
            assert.throws(error);
        }}

        const actualTypes = chalkColors.map(c => typeof c);
        const expectedTypes = chalkColors.map(c => 'function'); //eslint-disable-line no-unused-vars

        assert.deepEqual(actualTypes, expectedTypes, 'chalk colors are proper functions');
    });

    test('Log colors are correctly set', function(assert) {
        const chronicle = new Chronicle({ systemLogs: {} });

        try {
            chronicle.color.setLogColor('test1', 'red');
            chronicle.color.setLogColor('test2', 'white');
            chronicle.color.setLogColor('test3', 'blue');
        } catch { error => {
            assert.throws(error);
        }}

        const expectedKeys = ['test1', 'test2', 'test3']

        assert.deepEqual(Object.keys(chronicle.color.types), expectedKeys, 'configured color keys');
    });
});
