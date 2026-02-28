'use client';

import { useEffect } from 'react';
import { useCopilot } from './CopilotProvider';

interface CopilotPageContext {
  page: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
}

/**
 * Register page context for the co-pilot.
 * When the co-pilot is opened on this page, it will know what entity the user is viewing.
 * Cleans up on unmount.
 */
export function useCopilotContext(context: CopilotPageContext) {
  const { setPageContext } = useCopilot();

  useEffect(() => {
    setPageContext(context);
    return () => setPageContext(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.page, context.entityType, context.entityId]);
}
