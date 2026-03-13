// Lightweight structured logger (no external dependency)
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  // In production use JSON, in dev use readable format
  if (process.env.NODE_ENV === 'production') {
    console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
  } else {
    const color = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' }[level] || '';
    console[level === 'error' ? 'error' : 'log'](`${color}[${entry.timestamp}] ${level.toUpperCase()}\x1b[0m ${message}`, Object.keys(meta).length ? meta : '');
  }
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};

// Express request logging middleware
export function requestLogger(req, res, next) {
  const start = Date.now();

  // Skip health checks in production
  if (req.path === '/api/health') return next();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.session?.userId || null,
    };

    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.path} ${res.statusCode}`, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.path} ${res.statusCode}`, meta);
    } else if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path}`, meta);
    } else {
      logger.info(`${req.method} ${req.path} ${res.statusCode}`, meta);
    }
  });

  next();
}
