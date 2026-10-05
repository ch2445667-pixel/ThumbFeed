'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let browserClient: QueryClient | null = null;

function getQueryClient(): QueryClient {
  if (!browserClient) {
    browserClient = new QueryClient({
      defaultOptions: {
        queries: {
          // A focus event is not new data. Every query in this app opts out of
          // refetch-on-focus individually too; this is the backstop.
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          retry: 2,
        },
      },
    });
  }
  return browserClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
