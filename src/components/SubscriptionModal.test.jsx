// Component tests for SubscriptionModal
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SubscriptionModal from './SubscriptionModal'
import * as dodoPayments from '../lib/dodoPayments'
import toast from 'react-hot-toast'

// Mock dependencies
vi.mock('../lib/dodoPayments', () => ({
  createCheckoutSession: vi.fn(),
}))

vi.mock('../lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

// Mock window.location.href
delete window.location
window.location = { href: '' }

describe('SubscriptionModal', () => {
  let queryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      currentTier: 'free',
      ...props,
    }

    return render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionModal {...defaultProps} />
      </QueryClientProvider>
    )
  }

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = renderModal({ isOpen: false })
      expect(container.firstChild).toBeNull()
    })

    it('should render all three pricing tiers', () => {
      renderModal()
      expect(screen.getByText('Free')).toBeInTheDocument()
      expect(screen.getByText('Pro')).toBeInTheDocument()
      expect(screen.getByText('Plus')).toBeInTheDocument()
    })

    it('should display pricing correctly', () => {
      renderModal()
      expect(screen.getByText('$0')).toBeInTheDocument()
      expect(screen.getByText('$4.99')).toBeInTheDocument()
      expect(screen.getByText('$9.99')).toBeInTheDocument()
    })

    it('should show "Current Plan" for current tier', () => {
      renderModal({ currentTier: 'pro' })
      const proCard = screen.getByText('Pro').closest('div').closest('div')
      expect(proCard).toHaveTextContent('Current Plan')
    })

    it('should show close button', () => {
      renderModal()
      const closeButton = screen.getByLabelText('Close modal')
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn()
      renderModal({ onClose })

      const closeButton = screen.getByLabelText('Close modal')
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should initiate checkout for pro tier', async () => {
      dodoPayments.createCheckoutSession.mockResolvedValue('https://checkout.dodo.com/session-123')

      renderModal()

      const upgradeButton = screen.getByText('Lock in $4.99/mo')
      fireEvent.click(upgradeButton)

      await waitFor(() => {
        expect(dodoPayments.createCheckoutSession).toHaveBeenCalledWith({
          tier: 'pro',
        })
      })

      expect(window.location.href).toBe('https://checkout.dodo.com/session-123')
    })

    it('should handle checkout errors gracefully', async () => {
      dodoPayments.createCheckoutSession.mockRejectedValue(new Error('Checkout failed'))

      renderModal()

      const upgradeButton = screen.getByText('Lock in $4.99/mo')
      fireEvent.click(upgradeButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to initiate checkout. Please try again.')
      })
    })

    it('should disable buttons while loading', async () => {
      // Make checkout take time
      dodoPayments.createCheckoutSession.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('https://checkout.dodo.com'), 1000))
      )

      renderModal()

      const upgradeButton = screen.getByText('Lock in $4.99/mo')
      fireEvent.click(upgradeButton)

      // Check that button shows loading state
      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument()
      })
    })

    it('should upgrade to Plus tier when Plus button clicked', async () => {
      dodoPayments.createCheckoutSession.mockResolvedValue('https://checkout.dodo.com/session-456')

      renderModal()

      const upgradeButton = screen.getByText('Lock in $9.99/mo')
      fireEvent.click(upgradeButton)

      await waitFor(() => {
        expect(dodoPayments.createCheckoutSession).toHaveBeenCalledWith({
          tier: 'plus',
        })
      })
    })
  })

  describe('Current Tier States', () => {
    it('should disable upgrade button for current tier', () => {
      renderModal({ currentTier: 'pro' })

      const proCard = screen.getByText('Pro').closest('div').closest('div')
      const currentPlanButton = proCard.querySelector('button')

      expect(currentPlanButton).toBeDisabled()
      expect(currentPlanButton).toHaveTextContent('Current Plan')
    })

    it('should enable upgrade for higher tiers', () => {
      renderModal({ currentTier: 'free' })

      const proButton = screen.getByText('Lock in $4.99/mo')
      const plusButton = screen.getByText('Lock in $9.99/mo')

      expect(proButton).not.toBeDisabled()
      expect(plusButton).not.toBeDisabled()
    })
  })

  describe('Feature Display', () => {
    it('should show "Lock Early Price" badges for paid tiers', () => {
      renderModal()

      const badges = screen.getAllByText(/Lock Early Price/i)
      expect(badges).toHaveLength(2) // Pro and Plus
    })

    it('should show "Price locked forever" text', () => {
      renderModal()

      expect(screen.getAllByText('Price locked forever')).toHaveLength(2)
    })

    it('should show Core Reading for all tiers', () => {
      renderModal()

      const coreReadingElements = screen.getAllByText('Core Reading')
      expect(coreReadingElements.length).toBeGreaterThan(0)
    })
  })
})
