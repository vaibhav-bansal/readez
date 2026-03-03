import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { trackEvent, getPostHog } from './lib/posthog'
import Landing from './pages/Landing'
import Library from './pages/Library'
import Legal from './pages/Legal'
import Feedback from './pages/Feedback'
import SubscriptionSuccess from './pages/SubscriptionSuccess'
import SubscriptionCancel from './pages/SubscriptionCancel'
import Auth from './components/Auth'

// Lazy load the Reader component (includes heavy PDF.js library)
const Reader = lazy(() => import('./pages/Reader'))

function App() {
  // Send test events once when app loads
  useEffect(() => {
    // PostHog test - only send once per session
    const posthogTestSent = sessionStorage.getItem('posthog_test_sent')
    if (!posthogTestSent) {
      const posthog = getPostHog()
      if (posthog) {
        // Send a simple test event
        trackEvent('app_loaded', {
          test: true,
        })
        console.log('✅ PostHog test event sent: app_loaded')
        sessionStorage.setItem('posthog_test_sent', 'true')
      } else {
        console.warn('⚠️ PostHog not initialized - test event not sent')
      }
    }
  }, [])

  return (
    <Router>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      }>
        <Routes>
          {/* Public routes - no authentication */}
          <Route path="/" element={<Landing />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/feedback" element={<Feedback />} />

          {/* Subscription routes - require authentication */}
          <Route path="/subscription/success" element={<Auth><SubscriptionSuccess /></Auth>} />
          <Route path="/subscription/cancel" element={<Auth><SubscriptionCancel /></Auth>} />

          {/* Authenticated routes - wrapped in Auth */}
          <Route path="/library" element={<Auth><Library /></Auth>} />
          <Route path="/library/:bookId" element={<Auth><Reader /></Auth>} />

          {/* Backward compatibility - redirect old reader URLs */}
          <Route path="/reader/:bookId" element={<Navigate to="/library/:bookId" replace />} />

          {/* Fallback - redirect to landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App
