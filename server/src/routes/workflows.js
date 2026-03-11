import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getWorkflowDashboard, getValidTransitions } from '../services/workflowEngine.js';

const router = Router();

// GET /api/workflows — list all state machine definitions
router.get('/', requireAuth, (req, res) => {
  const machines = db.prepare('SELECT * FROM state_machines ORDER BY id').all();
  const result = machines.map(m => ({
    id: m.id,
    key: m.machine_key,
    name: m.name,
    entity: m.entity,
    category: m.category || 'general',
    states: JSON.parse(m.states_json),
    currentState: m.current_state,
    transitions: JSON.parse(m.transitions_json),
    rules: m.rules_json ? JSON.parse(m.rules_json) : null,
    blocking: m.blocking_json ? JSON.parse(m.blocking_json) : null,
  }));
  res.json(result);
});

// GET /api/workflows/:key — get a single state machine
router.get('/:key', requireAuth, (req, res) => {
  const m = db.prepare('SELECT * FROM state_machines WHERE machine_key = ?').get(req.params.key);
  if (!m) return res.status(404).json({ error: 'Workflow not found' });
  res.json({
    id: m.id,
    key: m.machine_key,
    name: m.name,
    entity: m.entity,
    category: m.category || 'general',
    states: JSON.parse(m.states_json),
    currentState: m.current_state,
    transitions: JSON.parse(m.transitions_json),
    rules: m.rules_json ? JSON.parse(m.rules_json) : null,
    blocking: m.blocking_json ? JSON.parse(m.blocking_json) : null,
  });
});

// GET /api/workflows/dashboard/:projectId — live workflow dashboard stats
router.get('/dashboard/:projectId', requireAuth, (req, res) => {
  try {
    const stats = getWorkflowDashboard(parseInt(req.params.projectId));
    res.json(stats);
  } catch (err) {
    res.json({ task: { items: [], total: 0 }, inspection: { items: [], total: 0 }, defect: { items: [], total: 0 }, ncr: { items: [], total: 0 }, rfi: { items: [], total: 0 }, recentTransitions: [], bottlenecks: [] });
  }
});

// GET /api/workflows/transitions/:machineKey — get valid transitions for current state
router.get('/transitions/:machineKey', requireAuth, (req, res) => {
  const { currentState } = req.query;
  if (!currentState) return res.status(400).json({ error: 'currentState query param required' });

  const transitions = getValidTransitions(req.params.machineKey, currentState, req.user.role);
  res.json(transitions);
});

// POST /api/workflows — create a new state machine (owner/pm only)
router.post('/', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const { machine_key, name, entity, category, states, current_state, transitions, rules, blocking } = req.body;
  if (!machine_key || !name || !entity || !states || !transitions) {
    return res.status(400).json({ error: 'machine_key, name, entity, states, and transitions are required' });
  }
  const existing = db.prepare('SELECT id FROM state_machines WHERE machine_key = ?').get(machine_key);
  if (existing) return res.status(409).json({ error: 'A workflow with this key already exists' });

  db.prepare(`INSERT INTO state_machines (machine_key, name, entity, category, states_json, current_state, transitions_json, rules_json, blocking_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(machine_key, name, entity, category || 'general',
      JSON.stringify(states), current_state || states[0],
      JSON.stringify(transitions),
      rules ? JSON.stringify(rules) : null,
      blocking ? JSON.stringify(blocking) : null);

  const created = db.prepare('SELECT * FROM state_machines WHERE machine_key = ?').get(machine_key);
  res.status(201).json({
    id: created.id, key: created.machine_key, name: created.name,
    entity: created.entity, category: created.category || 'general',
    states: JSON.parse(created.states_json), currentState: created.current_state,
    transitions: JSON.parse(created.transitions_json),
    rules: created.rules_json ? JSON.parse(created.rules_json) : null,
    blocking: created.blocking_json ? JSON.parse(created.blocking_json) : null,
  });
});

// PATCH /api/workflows/:key — update a state machine (owner/pm only)
router.patch('/:key', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const m = db.prepare('SELECT * FROM state_machines WHERE machine_key = ?').get(req.params.key);
  if (!m) return res.status(404).json({ error: 'Workflow not found' });

  const { name, entity, category, states, current_state, transitions, rules, blocking } = req.body;
  db.prepare(`UPDATE state_machines SET
    name = COALESCE(?, name), entity = COALESCE(?, entity), category = COALESCE(?, category),
    states_json = COALESCE(?, states_json), current_state = COALESCE(?, current_state),
    transitions_json = COALESCE(?, transitions_json),
    rules_json = COALESCE(?, rules_json), blocking_json = COALESCE(?, blocking_json)
    WHERE machine_key = ?`)
    .run(name || null, entity || null, category || null,
      states ? JSON.stringify(states) : null, current_state || null,
      transitions ? JSON.stringify(transitions) : null,
      rules !== undefined ? (rules ? JSON.stringify(rules) : null) : null,
      blocking !== undefined ? (blocking ? JSON.stringify(blocking) : null) : null,
      req.params.key);

  const updated = db.prepare('SELECT * FROM state_machines WHERE machine_key = ?').get(req.params.key);
  res.json({
    id: updated.id, key: updated.machine_key, name: updated.name,
    entity: updated.entity, category: updated.category || 'general',
    states: JSON.parse(updated.states_json), currentState: updated.current_state,
    transitions: JSON.parse(updated.transitions_json),
    rules: updated.rules_json ? JSON.parse(updated.rules_json) : null,
    blocking: updated.blocking_json ? JSON.parse(updated.blocking_json) : null,
  });
});

// DELETE /api/workflows/:key — delete a state machine (owner only)
router.delete('/:key', requireAuth, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Not authorized' });
  const m = db.prepare('SELECT * FROM state_machines WHERE machine_key = ?').get(req.params.key);
  if (!m) return res.status(404).json({ error: 'Workflow not found' });
  db.prepare('DELETE FROM state_machines WHERE machine_key = ?').run(req.params.key);
  res.json({ success: true });
});

export default router;
