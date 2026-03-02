// Dodo Payments Integration
// Handles checkout session creation and payment flows
// Calls backend API which securely communicates with Dodo Payments

import api from './api'

/**
 * Create Dodo Payments checkout session via backend API
 * @param {Object} params - Checkout parameters
 * @param {string} params.tier - Subscription tier (pro or plus)
 * @returns {Promise<string>} Checkout URL to redirect user to
 */
export async function createCheckoutSession({ tier }) {
  try {
    // Log current mode (helpful for debugging)
    const env = import.meta.env.VITE_ENV || 'TEST'
    console.log(`Dodo Payments Mode: ${env}`)

    // Call backend API
    const data = await api.payments.createCheckout(tier)

    if (!data.checkout_url) {
      throw new Error('No checkout URL returned')
    }

    return data.checkout_url
  } catch (error) {
    console.error('Error creating checkout session:', error)
    throw error
  }
}

/**
 * Get customer portal URL for managing subscription
 * Note: This would need a backend endpoint to be implemented
 * @param {string} customerId - Dodo customer ID
 * @returns {Promise<string>} Customer portal URL
 */
export async function getCustomerPortalUrl(customerId) {
  try {
    // TODO: Implement backend endpoint for customer portal
    // For now, this is not critical for the migration
    throw new Error('Customer portal not yet implemented')
  } catch (error) {
    console.error('Error getting customer portal:', error)
    throw error
  }
}
