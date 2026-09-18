/**
 * A small header reminder that appears only when the licence needs attention:
 * ending within a week, or already lapsed. Clicking it opens the licence page.
 */
import { Badge, Tooltip } from '@mantine/core';
import { IconKey } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { isLicenseBlocking, isLicenseWorthShowing, useLicenseStore } from '../../store/licenseStore';

export default function LicenseBadge() {
  const navigate = useNavigate();
  const status = useLicenseStore((state) => state.status);

  if (!isLicenseWorthShowing(status)) return null;

  const blocked = isLicenseBlocking(status);
  const label = blocked
    ? 'Licence expired'
    : status.daysLeft === 0
      ? 'Licence ends today'
      : `Licence: ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left`;

  return (
    <Tooltip label={status.message} withArrow multiline w={260}>
      <Badge
        size="sm"
        variant="light"
        color={blocked ? 'red' : 'orange'}
        leftSection={<IconKey size={11} />}
        style={{ cursor: 'pointer' }}
        onClick={() => navigate('/license')}
      >
        {label}
      </Badge>
    </Tooltip>
  );
}
