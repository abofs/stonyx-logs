import chalk from 'chalk';

export type ChalkColorFn = (text: string) => string;
export type ColorSetting = string | ChalkColorFn;

export default class Color {
  types: Record<string, ChalkColorFn> = {};

  getLogColor(type: string): ChalkColorFn {
    return this.types[type];
  }

  getChalkInstance(): typeof chalk {
    return chalk;
  }

  setLogColor(type: string, setting: ColorSetting): void {
    const chalkColorFunction = this.settingToChalkColorFunction(setting);
    this.types[type] = chalkColorFunction;
  }

  // retrieves chalk color function, and fully validates output
  settingToChalkColorFunction(setting: ColorSetting): ChalkColorFn {
    const errorMessage = 'Invalid chalk color function.'
      + 'For help with color settings, see https://github.com/abofs/stonyx-logs#defining-logs--colors';

    switch (typeof setting) {
    case 'string':
      const chalkColorFunction = (setting[0] === '#')
        ? chalk.hex(setting)
        : (chalk as unknown as Record<string, unknown>)[setting] as ChalkColorFn | undefined;
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
