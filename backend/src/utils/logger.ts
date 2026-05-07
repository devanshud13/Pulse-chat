/* Lightweight logger – swap with pino/winston if desired without changing call sites. */
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const stamp = (): string => new Date().toISOString();

const write = (level: LogLevel, args: unknown[]): void => {
  const prefix = `[${stamp()}] [${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
};

export const logger = {
  info: (...args: unknown[]): void => write('info', args),
  warn: (...args: unknown[]): void => write('warn', args),
  error: (...args: unknown[]): void => write('error', args),
  debug: (...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') write('debug', args);
  },
};
