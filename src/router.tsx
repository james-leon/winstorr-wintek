import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { isSessionExpiredError, recoverSession } from "./lib/session-recovery";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isSessionExpiredError(error)) {
            // Refresh the token (or drop the dead session and continue as a
            // visitor), then let the query run again.
            void recoverSession();
            return failureCount < 2;
          }
          return failureCount < 1;
        },
        retryDelay: (attempt) => Math.min(600 * (attempt + 1), 2000),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
