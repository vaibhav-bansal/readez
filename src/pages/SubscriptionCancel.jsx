// SubscriptionCancel Page
// Shown when user cancels the checkout process

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trackEvent } from '../lib/posthog'

export default function SubscriptionCancel() {
  const navigate = useNavigate()

  useEffect(() => {
    trackEvent('subscription_cancelled_viewed')
  }, [])

  const handleTryAgain = () => {
    trackEvent('subscription_try_again_clicked')
    navigate('/library')
    // User can click upgrade button again from library
  }

  const handleGoBack = () => {
    trackEvent('subscription_back_clicked')
    navigate('/library')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
        {/* Cancel Icon */}
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        {/* Cancel Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Checkout Cancelled
        </h1>
        <p className="text-gray-600 mb-6">
          No worries! Your subscription was not activated. You can upgrade anytime when you're ready.
        </p>

        {/* Info Box */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <h2 className="font-semibold text-gray-900 mb-2">Early Bird Pricing Still Available</h2>
          <p className="text-sm text-gray-600">
            Lock in the discounted pricing now before it increases. This offer won't last forever!
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleTryAgain}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleGoBack}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Back to Library
          </button>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Questions? Contact us at support@readez.xyz
        </p>
      </div>
    </div>
  )
}
