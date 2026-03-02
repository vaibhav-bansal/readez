import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FeedbackForm from './FeedbackForm'
import api from '../lib/api'

// Mock API
vi.mock('../lib/api', () => ({
  default: {
    auth: {
      getCurrentUser: vi.fn(() =>
        Promise.resolve({
          id: 'test-user-id',
          email: 'test@example.com',
        })
      ),
    },
    feedback: {
      submit: vi.fn(() =>
        Promise.resolve({
          id: 'test-feedback-id',
          category: 'general',
          subject: 'Test Subject',
          description: 'Test Description',
        })
      ),
    },
  },
}))

// Mock PostHog
vi.mock('../lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const renderWithClient = (ui) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('FeedbackForm', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  it('renders all form fields', () => {
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('auto-fills email for authenticated user', async () => {
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveValue('test@example.com')
    })
  })

  it('displays correct category options', () => {
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    const categorySelect = screen.getByLabelText(/category/i)
    const options = categorySelect.querySelectorAll('option')

    expect(options).toHaveLength(4)
    expect(options[0]).toHaveTextContent('General Query')
    expect(options[1]).toHaveTextContent('Feature Request')
    expect(options[2]).toHaveTextContent('Bug Report')
    expect(options[3]).toHaveTextContent('Other')
  })

  it('has default category set to general', () => {
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    const categorySelect = screen.getByLabelText(/category/i)
    expect(categorySelect).toHaveValue('general')
  })

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup()
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('has required validation attributes on all fields', () => {
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    const emailInput = screen.getByLabelText(/email/i)
    const categorySelect = screen.getByLabelText(/category/i)
    const subjectInput = screen.getByLabelText(/subject/i)
    const descriptionInput = screen.getByLabelText(/description/i)

    expect(emailInput).toHaveAttribute('required')
    expect(categorySelect).toHaveAttribute('required')
    expect(subjectInput).toHaveAttribute('required')
    expect(descriptionInput).toHaveAttribute('required')
  })

  it('has email type validation on email field', () => {
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    const emailInput = screen.getByLabelText(/email/i)

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('required')
  })

  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveValue('test@example.com')
    })

    const subjectInput = screen.getByLabelText(/subject/i)
    const descriptionInput = screen.getByLabelText(/description/i)

    await user.type(subjectInput, 'Test Subject')
    await user.type(descriptionInput, 'This is a test description')

    const submitButton = screen.getByRole('button', { name: /submit feedback/i })
    await user.click(submitButton)

    // Wait for success state
    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument()
    })
  })

  it('shows success message after submission', async () => {
    const user = userEvent.setup()
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveValue('test@example.com')
    })

    await user.type(screen.getByLabelText(/subject/i), 'Test Subject')
    await user.type(screen.getByLabelText(/description/i), 'Test Description')
    await user.click(screen.getByRole('button', { name: /submit feedback/i }))

    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument()
      expect(screen.getByText(/your feedback has been submitted successfully/i)).toBeInTheDocument()
    })
  })

  it('allows changing category', async () => {
    const user = userEvent.setup()
    renderWithClient(<FeedbackForm onClose={mockOnClose} />)

    const categorySelect = screen.getByLabelText(/category/i)

    expect(categorySelect).toHaveValue('general')

    await user.selectOptions(categorySelect, 'bug')
    expect(categorySelect).toHaveValue('bug')
  })
})
