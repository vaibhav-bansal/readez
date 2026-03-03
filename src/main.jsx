import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { initPostHog } from './lib/posthog'
import { testPostHog, testSingleEvent, checkPostHogStatus } from './lib/posthogTest'

// Initialize PostHog
initPostHog()

// Make test functions available globally for console testing
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.testPostHog = testPostHog
  window.testPosthog = testPostHog // Alias with lowercase 'h' for convenience
  window.testSingleEvent = testSingleEvent
  window.checkPostHogStatus = checkPostHogStatus
  console.log('%c🧪 PostHog Test Functions Ready', 'color: #00ff00; font-weight: bold;')
  console.log('  Try: window.testPostHog() or window.testPosthog()')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>,
)
