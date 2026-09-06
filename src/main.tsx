import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import './lib/i18n'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabaseClient'

// ── Sentry Error Monitoring & Session Replay ──
const sentryDsn = import.meta.env.VITE_SENTRY_DSN || "https://1145e70c28553a6bf234c6b9f6a2e3eb@o4512040342126592.ingest.us.sentry.io/4512040398290944";

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Filtro anti-ruido: ignorar cancelaciones normales de red y chunks obsoletos por nuevo deploy
    ignoreErrors: [
      'AbortError',
      'The user aborted a request.',
      'signal is aborted without reason',
      'Failed to fetch',
      'NetworkError',
      'Load failed',
      'Failed to fetch dynamically imported module',
      'Importing a module script failed',
      'error loading dynamically imported module',
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE || 'production',
    beforeSend(event, hint) {
      try {
        const errorName = String(hint?.originalException && typeof hint.originalException === 'object' && 'name' in hint.originalException ? (hint.originalException as any).name : event.exception?.values?.[0]?.type || 'Error');
        const errorMessage = String(hint?.originalException && typeof hint.originalException === 'object' && 'message' in hint.originalException ? (hint.originalException as any).message : event.exception?.values?.[0]?.value || event.message || 'Error sin mensaje');
        const stackTrace = String(hint?.originalException && typeof hint.originalException === 'object' && 'stack' in hint.originalException ? (hint.originalException as any).stack : '');
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        const userBrowser = (event.contexts?.browser?.name ? `${event.contexts.browser.name} ${event.contexts.browser.version || ''}` : navigator.userAgent).trim();
        const userOs = (event.contexts?.os?.name ? `${event.contexts.os.name} ${event.contexts.os.version || ''}` : '').trim();
        const userDevice = typeof window !== 'undefined' && window.innerWidth < 768 ? 'Móvil' : 'Escritorio / Tablet';
        
        const breadcrumbs = (event.breadcrumbs || []).slice(-10).map(b => ({
          category: b.category,
          message: b.message,
          data: b.data,
          timestamp: b.timestamp
        }));

        const sentryUrl = event.event_id 
          ? `https://sentry.io/organizations/o4512040342126592/issues/?query=${event.event_id}`
          : 'https://sentry.io/organizations/o4512040342126592/issues/';

        // Guardar asíncronamente en Supabase
        supabase.from('system_errors').insert([{
          event_id: event.event_id,
          error_name: errorName,
          error_message: errorMessage,
          stack_trace: stackTrace,
          url: currentUrl,
          user_device: userDevice,
          user_browser: userBrowser,
          user_os: userOs,
          breadcrumbs,
          sentry_url: sentryUrl,
          resolved: false
        }]).then(({ error }: any) => {
          if (error) console.warn('[Sentry -> Supabase] Info:', error.message);
        }, () => {});
      } catch {
        // Silencioso para blindar la ejecución
      }
      return event;
    }
  });
}

// Auto-recarga transparente si el usuario navega teniendo una versión anterior en caché tras un deploy
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const lastReload = sessionStorage.getItem('citalink_chunk_reload');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('citalink_chunk_reload', String(now));
    window.location.reload();
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes cache
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// Registrar Service Worker para PWA de forma asíncrona (retrasado 3s para no congelar la primera carga en Safari)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('SW registrado con éxito:', registration.scope);
      }, err => {
        console.log('Fallo el registro del SW:', err);
      });
    }, 3000);
  });
}
