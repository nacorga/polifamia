import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiRequestError } from '../../src/lib/api-client';
import { App } from './App';
import './style.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reintentos acotados solo ante fallos de red; los 4xx son definitivos.
      retry: (n, err) => n < 2 && err instanceof ApiRequestError && err.code === 'network',
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
