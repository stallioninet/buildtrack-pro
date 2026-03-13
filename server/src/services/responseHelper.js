// Standardized API response helpers

export function success(res, data, status = 200) {
  return res.status(status).json(data);
}

export function created(res, data) {
  return res.status(201).json(data);
}

export function paginated(res, { data, page, limit, total }) {
  return res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export function error(res, message, status = 400) {
  return res.status(status).json({ error: message });
}

export function notFound(res, entity = 'Resource') {
  return res.status(404).json({ error: `${entity} not found` });
}

export function forbidden(res, message = 'Insufficient permissions') {
  return res.status(403).json({ error: message });
}

// Parse pagination params from query
export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit) || 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
