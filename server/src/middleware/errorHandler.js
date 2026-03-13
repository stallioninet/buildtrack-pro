import { logger } from './logger.js';

export function errorHandler(err, req, res, _next) {
  // Log error details (not exposed to client)
  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    code: err.code,
  });

  // Handle specific error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 25MB.' });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files. Maximum is 10 per upload.' });
  }

  if (err.message?.includes('File type not allowed')) {
    return res.status(400).json({ error: err.message });
  }

  // SQLite constraint errors
  if (err.message?.includes('UNIQUE constraint failed')) {
    return res.status(409).json({ error: 'A record with this value already exists' });
  }

  if (err.message?.includes('FOREIGN KEY constraint failed')) {
    return res.status(400).json({ error: 'Referenced record not found' });
  }

  // Default error
  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
}
