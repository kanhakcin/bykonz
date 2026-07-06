import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { StrictMode, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import { useLocale } from './hooks/use-locale';
// Import configurations and contexts
import i18n from './lib/config/i18n.config'; // Importa a configuração do i18next
import { SocketProvider } from './lib/config/socket.config';
// Import the generated route tree
import { routeTree } from './routeTree.gen';

import './styles.css';

import reportWebVitals from './reportWebVitals.ts';

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// App component with all providers
function App() {
  // Use Zustand store for locale - this will automatically re-render when locale changes
  const locale = useLocale((state) => state.locale);

  // Sync i18next with our locale store
  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [locale]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange themes={['light', 'dark', 'ocean-blue', 'sunset']}>
        <SocketProvider>
          <RouterProvider router={router} />
          <Toaster position="bottom-left" expand={false} richColors closeButton />
        </SocketProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Render the app
const rootElement = document.getElementById('app');
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
