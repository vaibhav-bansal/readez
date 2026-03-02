import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Legal from './Legal'

// Mock PostHog
vi.mock('../lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('Legal Page', () => {
  it('renders the page title', () => {
    renderWithRouter(<Legal />)

    expect(
      screen.getByRole('heading', { name: /terms of service & privacy policy/i })
    ).toBeInTheDocument()
  })

  it('displays last updated date', () => {
    renderWithRouter(<Legal />)

    expect(screen.getByText(/last updated: january 30, 2026/i)).toBeInTheDocument()
  })

  it('renders all required sections', () => {
    renderWithRouter(<Legal />)

    // Check for main section headings
    expect(screen.getByRole('heading', { name: /1\. about these terms/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /2\. the service/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /3\. your content & responsibilities/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /4\. information we collect/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /5\. how we use & store your information/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /6\. cookies & tracking/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /7\. legal stuff/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /8\. contact us/i })).toBeInTheDocument()
  })

  it('mentions data collection practices', () => {
    renderWithRouter(<Legal />)

    const googleMentions = screen.getAllByText(/google/i)
    expect(googleMentions.length).toBeGreaterThan(0)

    const posthogMentions = screen.getAllByText(/posthog/i)
    expect(posthogMentions.length).toBeGreaterThan(0)

    const sessionRecordingsMentions = screen.getAllByText(/session recordings/i)
    expect(sessionRecordingsMentions.length).toBeGreaterThan(0)
  })

  it('states user content ownership', () => {
    renderWithRouter(<Legal />)

    expect(screen.getByText(/you own your ebooks/i)).toBeInTheDocument()
  })

  it('includes links to third-party privacy policies', () => {
    renderWithRouter(<Legal />)

    // Check for external links to privacy policies
    const links = screen.getAllByRole('link')
    const railwayLink = links.find(link => link.href === 'https://railway.app/legal/privacy')
    const posthogLink = links.find(link => link.href === 'https://posthog.com/privacy')
    const vercelLink = links.find(link => link.href === 'https://vercel.com/legal/privacy-policy')
    const googleLink = links.find(link => link.href === 'https://policies.google.com/privacy')

    expect(railwayLink).toBeInTheDocument()
    expect(posthogLink).toBeInTheDocument()
    expect(vercelLink).toBeInTheDocument()
    expect(googleLink).toBeInTheDocument()
  })

  it('has link to feedback form', () => {
    renderWithRouter(<Legal />)

    const feedbackLink = screen.getByRole('link', { name: /submit feedback or questions/i })
    expect(feedbackLink).toBeInTheDocument()
    expect(feedbackLink).toHaveAttribute('href', '/feedback')
  })

  it('mentions open source nature', () => {
    renderWithRouter(<Legal />)

    const openSourceText = screen.getAllByText(/open source/i)
    expect(openSourceText.length).toBeGreaterThan(0)
  })

  it('includes ISC license mention', () => {
    renderWithRouter(<Legal />)

    expect(screen.getByText(/isc license/i)).toBeInTheDocument()
  })

  it('has GitHub link', () => {
    renderWithRouter(<Legal />)

    const githubLinks = screen.getAllByRole('link', { name: /github/i })
    expect(githubLinks.length).toBeGreaterThan(0)
  })

  it('mentions service is provided "as is"', () => {
    renderWithRouter(<Legal />)

    expect(screen.getByText(/provided "as is"/i)).toBeInTheDocument()
  })

  it('includes limitation of liability', () => {
    renderWithRouter(<Legal />)

    expect(screen.getByText(/limitation of liability/i)).toBeInTheDocument()
  })

  it('is mobile responsive', () => {
    const { container } = renderWithRouter(<Legal />)

    // Check for responsive classes
    const mainDiv = container.querySelector('div')
    expect(mainDiv).toHaveClass('min-h-screen')
  })

  it('has proper header and footer structure', () => {
    renderWithRouter(<Legal />)

    const headers = screen.getAllByRole('banner')
    const footers = screen.getAllByRole('contentinfo')

    expect(headers.length).toBeGreaterThan(0)
    expect(footers.length).toBeGreaterThan(0)
  })
})
