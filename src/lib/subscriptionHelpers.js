// Subscription Helper Functions
// Utilities for checking subscription tiers, feature access, and usage limits

import api from './api'

// Subscription tiers
export const TIERS = {
  FREE: 'free',
  PRO: 'pro',
  PLUS: 'plus',
}

// Subscription status
export const STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  TRIALING: 'trialing',
}

// Feature limits by tier
export const FEATURE_LIMITS = {
  [TIERS.FREE]: {
    ai_summaries: 3,
    storage_mb: 100,
    books: 10,
    collections: 3,
    themes: 3,
  },
  [TIERS.PRO]: {
    ai_summaries: -1,
    storage_mb: 5120,
    books: -1,
    collections: -1,
    themes: 15,
  },
  [TIERS.PLUS]: {
    ai_summaries: -1,
    storage_mb: 25600,
    books: -1,
    collections: -1,
    themes: -1,
  },
}

/**
 * Get user's current subscription
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} Subscription object or null
 */
export async function getUserSubscription(userId) {
  try {
    const data = await api.subscription.get()
    return data.subscription || {
      user_id: userId,
      tier: TIERS.FREE,
      status: STATUS.ACTIVE,
    }
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return {
      user_id: userId,
      tier: TIERS.FREE,
      status: STATUS.ACTIVE,
    }
  }
}

/**
 * Check if user has access to a specific tier
 * @param {string} userTier - User's current tier
 * @param {string} requiredTier - Required tier for feature
 * @returns {boolean}
 */
export function hasAccessToTier(userTier, requiredTier) {
  const tierHierarchy = [TIERS.FREE, TIERS.PRO, TIERS.PLUS]
  const userLevel = tierHierarchy.indexOf(userTier)
  const requiredLevel = tierHierarchy.indexOf(requiredTier)

  return userLevel >= requiredLevel
}

/**
 * Get feature usage for a user
 * @param {string} userId - User ID
 * @param {string} feature - Feature name
 * @returns {Promise<object|null>} Usage object
 */
export async function getFeatureUsage(userId, feature) {
  try {
    const usageList = await api.subscription.getUsage()
    const usage = usageList.find(u => u.feature === feature)

    if (!usage) {
      return {
        usage_count: 0,
        reset_at: getNextMonthStart(),
      }
    }

    return usage
  } catch (error) {
    console.error('Error fetching feature usage:', error)
    return {
      usage_count: 0,
      reset_at: getNextMonthStart(),
    }
  }
}

/**
 * Check if user can use a feature (based on tier and usage limits)
 * @param {string} userId - User ID
 * @param {string} feature - Feature name
 * @param {string} userTier - User's current tier
 * @returns {Promise<{canUse: boolean, reason: string|null, usageCount: number, limit: number}>}
 */
export async function canUseFeature(userId, feature, userTier) {
  const limit = FEATURE_LIMITS[userTier]?.[feature]

  if (!limit || limit === -1) {
    return {
      canUse: true,
      reason: null,
      usageCount: 0,
      limit: -1,
    }
  }

  const usage = await getFeatureUsage(userId, feature)

  if (!usage) {
    return {
      canUse: true,
      reason: null,
      usageCount: 0,
      limit,
    }
  }

  const canUse = usage.usage_count < limit

  return {
    canUse,
    reason: canUse ? null : `You've reached your ${feature} limit for this month`,
    usageCount: usage.usage_count,
    limit,
  }
}

/**
 * Get the start of next month (for reset_at)
 * @returns {string} ISO timestamp
 */
function getNextMonthStart() {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth.toISOString()
}

/**
 * Format tier name for display
 * @param {string} tier - Tier name
 * @returns {string} Formatted tier name
 */
export function formatTierName(tier) {
  const tierNames = {
    [TIERS.FREE]: 'Free',
    [TIERS.PRO]: 'Pro',
    [TIERS.PLUS]: 'Plus',
  }
  return tierNames[tier] || tier
}

/**
 * Get tier color for badges
 * @param {string} tier - Tier name
 * @returns {string} Tailwind color class
 */
export function getTierColor(tier) {
  const colors = {
    [TIERS.FREE]: 'gray',
    [TIERS.PRO]: 'blue',
    [TIERS.PLUS]: 'purple',
  }
  return colors[tier] || 'gray'
}
