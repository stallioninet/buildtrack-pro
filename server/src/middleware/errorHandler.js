export function errorHandler(err, req, res, _next) {
  console.error('Error:', err.message);
  console.error(err.stack);

  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
}
