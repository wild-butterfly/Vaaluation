import { useCallback, useEffect, useState } from 'react';
import type { PermissionStatus } from '../native/VLPermissions';
import { getPermissionStatus } from '../native/VLPermissions';
import { onPermissionsChanged } from '../native/VLEvents';

/**
 * Live permission state: loads once, refreshes whenever the app becomes
 * active again (native emits after the user visits System Settings).
 */
export function usePermissions(): {
  status: PermissionStatus | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  const refresh = useCallback(() => {
    getPermissionStatus()
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    return onPermissionsChanged((next) => {
      setStatus(next as PermissionStatus);
    });
  }, [refresh]);

  return { status, refresh };
}
