// useSubscription Hook
// React hook for accessing user's subscription data throughout the app

import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import {
  getUserSubscription,
  hasAccessToTier,
  canUseFeature as checkFeatureAccess,
  TIERS,
} from '../lib/subscriptionHelpers'

/**
 * Hook to get and manage user subscription
 * @param {string} userId - User ID
 * @returns {object} Subscription data and helper methods
 */
export function useSubscription(userId) {
  // Fetch subscription data with React Query
  const {
    data: subscription,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => getUserSubscription(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Get user's effective tier (treat non-active subscriptions as free)
  const isActive = subscription?.status === 'active'
  const tier = isActive ? (subscription?.tier || TIERS.FREE) : TIERS.FREE

  // Helper methods
  const hasAccess = (requiredTier) => {
    return hasAccessToTier(tier, requiredTier)
  }

  const canUseFeature = async (feature) => {
    if (!userId) return { canUse: false, reason: 'User not authenticated' }
    return await checkFeatureAccess(userId, feature, tier)
  }

  const isPro = tier === TIERS.PRO || tier === TIERS.PLUS
  const isPlus = tier === TIERS.PLUS
  const isFree = tier === TIERS.FREE
  const isCancelled = subscription?.cancel_at_period_end === true

  return {
    subscription,
    tier,
    isLoading,
    error,
    refetch,
    hasAccess,
    canUseFeature,
    isPro,
    isPlus,
    isFree,
    isActive,
    isCancelled,
  }
}

/**
 * Hook for polling subscription status (e.g., after payment)
 * @param {object} options - Polling options
 * @param {boolean} options.enabled - Whether polling is enabled
 * @param {number} options.interval - Poll interval in ms (default 2000)
 * @param {function} options.onSuccess - Callback when subscription becomes active
 */
export function useSubscriptionPolling(options = {}) {
  const {
    enabled = false,
    interval = 2000,
    onSuccess,
  } = options

  const { data: subscriptionData, refetch } = useQuery({
    queryKey: ['subscription-poll'],
    queryFn: async () => {
      const data = await api.subscription.get()
      return data.subscription
    },
    enabled,
    refetchInterval: enabled ? interval : false,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })

  // Check for success condition
  if (enabled && subscriptionData && subscriptionData.tier !== TIERS.FREE) {
    onSuccess?.(subscriptionData)
  }

  return {
    subscription: subscriptionData,
    refetch,
  }
}
