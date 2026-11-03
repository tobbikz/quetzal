/** Structured JSON logs for Quetzal (one object per line on stdout/stderr). */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

function emit(level: LogLevel, msg: string, fields?: LogFields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    service: 'quetzal',
    ...(fields ?? {}),
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  debug: (msg: string, fields?: LogFields) => emit('debug', msg, fields),
  info: (msg: string, fields?: LogFields) => emit('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => emit('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => emit('error', msg, fields),
};
