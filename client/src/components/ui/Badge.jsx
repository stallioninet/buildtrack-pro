import { memo } from 'react';
import { statusColor } from '../../utils/formatters';

function Badge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(status)}`}>
      {status}
    </span>
  );
}

export default memo(Badge);
