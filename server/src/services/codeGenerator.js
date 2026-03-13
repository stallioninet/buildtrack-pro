import db from '../config/db.js';

/**
 * Generate the next sequential code for an entity.
 * @param {string} table - Table name (e.g., 'ncrs', 'rfis', 'tasks')
 * @param {string} column - Code column name (e.g., 'ncr_code', 'rfi_code')
 * @param {string} prefix - Code prefix (e.g., 'NCR', 'RFI', 'TSK')
 * @param {object} [options] - Optional filter conditions
 * @param {string} [options.where] - WHERE clause (e.g., 'stage_id = ?')
 * @param {any[]} [options.params] - Parameters for the WHERE clause
 * @returns {string} Next code (e.g., 'NCR-006')
 */
export function generateNextCode(table, column, prefix, options = {}) {
  let sql = `SELECT ${column} FROM ${table}`;
  const params = [];

  if (options.where) {
    sql += ` WHERE ${options.where}`;
    params.push(...(options.params || []));
  }

  sql += ` ORDER BY id DESC LIMIT 1`;

  const lastRow = db.prepare(sql).get(...params);

  if (!lastRow || !lastRow[column]) {
    return `${prefix}-001`;
  }

  const lastCode = lastRow[column];
  const match = lastCode.match(/(\d+)$/);
  if (!match) return `${prefix}-001`;

  const nextNum = parseInt(match[1]) + 1;
  const padLength = Math.max(3, match[1].length);
  return `${prefix}-${String(nextNum).padStart(padLength, '0')}`;
}
