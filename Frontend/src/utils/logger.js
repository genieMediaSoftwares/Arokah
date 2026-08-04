/**
 * Frontend logging.
 *
 * Components never call `console.*` directly. In development this writes to the
 * console as usual; in a production build it stays silent, so internal error
 * details and payload shapes are not printed into a visitor's console for
 * anyone to read.
 *
 * `import.meta.env.DEV` is replaced at build time, so the production bundle
 * drops these branches entirely.
 */
const isDev = import.meta.env.DEV;

function emit(level, message, context) {
  if (!isDev) return;
  const prefix = `[${level.toUpperCase()}]`;
  if (context === undefined) {
    console[level](prefix, message);
  } else {
    console[level](prefix, message, context);
  }
}

const logger = {
  debug: (message, context) => emit("debug", message, context),
  info: (message, context) => emit("info", message, context),
  warn: (message, context) => emit("warn", message, context),
  error: (message, context) => emit("error", message, context),
};

export default logger;
