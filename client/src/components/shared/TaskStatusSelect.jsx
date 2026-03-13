import { statusColor } from '../../utils/formatters';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'ready_for_inspection', label: 'Ready for Inspection' },
  { value: 'rework', label: 'Rework' },
  { value: 'completed', label: 'Completed' },
];

const VALID_TRANSITIONS = {
  not_started: ['in_progress'],
  in_progress: ['on_hold', 'ready_for_inspection'],
  on_hold: ['in_progress'],
  ready_for_inspection: ['completed', 'rework'],
  rework: ['in_progress'],
  completed: [],
};

export default function TaskStatusSelect({ value, onChange, disabled }) {
  if (disabled) {
    const label = STATUS_OPTIONS.find(o => o.value === value)?.label || value;
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(value)}`}>
        {label}
      </span>
    );
  }

  const nextStates = VALID_TRANSITIONS[value] || [];
  const allowedValues = [value, ...nextStates];
  const options = STATUS_OPTIONS.filter(o => allowedValues.includes(o.value));

  return (
    <select
      value={value}
      onChange={(e) => { if (e.target.value !== value) onChange(e.target.value); }}
      className={`text-xs font-medium rounded px-2 py-1 border-0 cursor-pointer ${statusColor(value)}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
