import { PropsWithChildren, useEffect } from 'react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { isDemoMode } from '../../app/dataMode';
import { expiresAt, sessionStore } from './session';

export function bindAuthLifecycle(queryClient: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previous = sessionStore.get();
  const schedule = () => {
    clearTimeout(timer);
    const session = sessionStore.get();
    if (!isDemoMode && session) {
      const remaining = expiresAt(session.token) - Date.now();
      if (remaining <= 0) sessionStore.invalidate(session.token);
      else timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    }
  };
  const unsubscribe = sessionStore.subscribe(() => {
    if (sessionStore.get() !== previous) {
      // clear() destroys active queries and clears both query and mutation caches.
      queryClient.clear();
      previous = sessionStore.get();
    }
    schedule();
  });
  schedule();
  window.addEventListener('focus', schedule);
  return () => { unsubscribe(); clearTimeout(timer); window.removeEventListener('focus', schedule); };
}
export function AuthLifecycle({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  useEffect(() => bindAuthLifecycle(queryClient), [queryClient]);
  return children;
}
