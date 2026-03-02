// SubscriptionSuccess Page
// Shown after successful subscription purchase
// Polls for subscription status update until confirmed or timeout

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { trackEvent } from '../lib/posthog'

const POLL_INTERVAL = 2000 // 2 seconds
const POLL_TIMEOUT = 30000 // 30 seconds

export default function SubscriptionSuccess() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('processing') // processing, success, timeout
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    trackEvent('subscription_success_viewed')
  }, [])

  // Poll for subscription status
  const { data: subscriptionData, isLoading } = useQuery({
    queryKey: ['subscription-poll'],
    queryFn: async () => {
      const data = await api.subscription.get()
      return data.subscription
    },
    refetchInterval: status === 'processing' ? POLL_INTERVAL : false,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })

  // Check subscription status on data change
  useEffect(() => {
    if (subscriptionData && subscriptionData.tier !== 'free' && subscriptionData.status === 'active') {
      setStatus('success')
      setSubscription(subscriptionData)
      trackEvent('subscription_activated', {
        tier: subscriptionData.tier,
      })
    }
  }, [subscriptionData])

  // Timeout handling
  useEffect(() => {
    if (status === 'processing') {
      const timeout = setTimeout(() => {
        setStatus('timeout')
        trackEvent('subscription_polling_timeout')
      }, POLL_TIMEOUT)

      return () => clearTimeout(timeout)
    }
  }, [status])

  const handleContinue = () => {
    navigate('/library')
  }

  // Processing state
  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          {/* Processing Animation */}
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>

          {/* Processing Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Processing Your Payment...
          </h1>
          <p className="text-gray-600 mb-6">
            We're confirming your subscription. This usually takes a few seconds.
          </p>

          {/* Progress indicator */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>

          <p className="text-sm text-gray-500">
            Please don't close this page.
          </p>
        </div>
      </div>
    )
  }

  // Timeout state
  if (status === 'timeout') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          {/* Warning Icon */}
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {/* Warning Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Processing
          </h1>
          <p className="text-gray-600 mb-6">
            Your payment is still being processed. You'll receive a confirmation email shortly.
          </p>

          {/* CTA Button */}
          <button
            onClick={handleContinue}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Continue to Library
          </button>

          <p className="mt-4 text-sm text-gray-500">
            Your subscription will be activated automatically once payment is confirmed.
          </p>
        </div>
      </div>
    )
  }

  // Success state
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Subscription Activated!
        </h1>
        <p className="text-gray-600 mb-6">
          Thank you for upgrading to {subscription?.tier || 'Pro'}! Your subscription is now active.
        </p>

        {/* What's Next */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <h2 className="font-semibold text-gray-900 mb-2">What happens next?</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Your subscription is active immediately</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>All premium features are now available</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Your price is locked in forever</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Check your email for receipt</span>
            </li>
          </ul>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleContinue}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Continue to Library
        </button>
      </div>
    </div>
  )
}
