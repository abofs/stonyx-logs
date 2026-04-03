import chalk from 'chalk';

export default class Color {
  constructor() {
    this.types = [];
  }

  // retrieves configured color function for log type
  getLogColor(type) {
    return this.types[type];
  }

  getChalkInstance() {
    return chalk;
  }

  setLogColor(type, setting) {
    const chalkColorFunction = this.settingToChalkColorFunction(setting);
    this.types[type] = chalkColorFunction;
  }

  // retrieves chalk color function, and fully validates output
  settingToChalkColorFunction(setting) {
    const errorMessage = 'Invalid chalk color function.'
      + 'For help with color settings, see https://github.com/abofs/chronicle#defining-logs--colors';

    switch (typeof setting) {
    case 'string':
      const chalkColorFunction = (setting[0] === '#') ? chalk.hex(setting) : chalk[setting];
      if (!chalkColorFunction
          || typeof chalkColorFunction !== 'function'
          || typeof chalkColorFunction('') !== 'string') {
        throw errorMessage;
      }

      return chalkColorFunction;

    case 'function':
      // validate that given function returns a string
      if (typeof setting('') !== 'string') {
        throw errorMessage;
      }

      return setting;

    default:
      throw errorMessage;
    }
  }
}
