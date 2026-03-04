import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { trackEvent } from '../lib/posthog'
import { createCheckoutSession } from '../lib/dodoPayments'

const GITHUB_REPO_URL = 'https://github.com/vaibhav-bansal/readez'

function Landing() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loadingTier, setLoadingTier] = useState(null)
  const [signInLoading, setSignInLoading] = useState(false)

  useEffect(() => {
    // Track landing page view
    trackEvent('landing_page_viewed')

    // Check if user is authenticated (but don't redirect)
    const checkAuth = async () => {
      try {
        const status = await api.auth.getStatus()
        if (status.authenticated) {
          setIsAuthenticated(true)
        }
      } catch {
        // Not authenticated
      }
    }
    checkAuth()

    // Scroll to section if URL has a hash
    if (window.location.hash) {
      const sectionId = window.location.hash.substring(1)
      const section = document.getElementById(sectionId)
      if (section) {
        setTimeout(() => {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    }
  }, [])

  const handleGetStarted = async () => {
    try {
      setSignInLoading(true)
      trackEvent('get_started_clicked')

      // Open popup for Google OAuth - returns user data directly
      await api.auth.loginWithGoogle()

      // Auth successful
      trackEvent('user_signed_in', { method: 'google_oauth', source: 'landing' })
      toast.success('Signed in successfully!')

      // Refresh page to update auth state
      window.location.href = '/library'
    } catch (error) {
      console.error('Error signing in:', error)
      trackEvent('get_started_failed', {
        error: error.message || 'Unknown error',
      })
      // Don't show error for user cancellation
      if (error.message !== 'Authentication cancelled') {
        toast.error(error.message || 'Failed to sign in')
      }
    } finally {
      setSignInLoading(false)
    }
  }

  const handleUpgradeClick = async (tier) => {
    trackEvent('landing_upgrade_clicked', { tier })

    // Check if user is authenticated
    try {
      const status = await api.auth.getStatus()

      if (status.authenticated) {
        // User is authenticated, directly initiate checkout
        setLoadingTier(tier)
        try {
          const checkoutUrl = await createCheckoutSession({ tier })
          window.location.href = checkoutUrl
        } catch (error) {
          console.error('Error initiating checkout:', error)
          toast.error(error.message || 'Failed to initiate checkout. Please try again.')
          trackEvent('landing_upgrade_failed', {
            tier,
            error: error.message
          })
          setLoadingTier(null)
        }
      } else {
        // User not authenticated, sign them in first
        toast.error('Please sign in first to upgrade')
        handleGetStarted()
      }
    } catch {
      toast.error('Please sign in first to upgrade')
      handleGetStarted()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">ReadEz</h1>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#home" onClick={() => trackEvent('landing_section_scrolled', { section: 'home' })} className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              Home
            </a>
            <a href="#features" onClick={() => trackEvent('landing_section_scrolled', { section: 'features' })} className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              Features
            </a>
            <a href="#readez-in-action" onClick={() => trackEvent('landing_section_scrolled', { section: 'readez-in-action' })} className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              ReadEz in Action
            </a>
            <a href="#pricing" onClick={() => trackEvent('landing_section_scrolled', { section: 'pricing' })} className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              Pricing
            </a>
            {isAuthenticated && (
              <Link to="/library" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
                Library
              </Link>
            )}
          </nav>

          {/* Right side icons */}
          <div className="flex items-center gap-4">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('landing_github_clicked')}
              className="text-gray-700 hover:text-gray-900 transition-colors"
              aria-label="View on GitHub"
              title="View on GitHub"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-6">
          Your Personal Ebook Library,
          <br />
          Synced Across All Devices
        </h2>
        <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
          ReadEz is a free, universal ebook reader supporting PDF, EPUB, and more. Keep your reading progress synchronized across all your devices.
          Upload, read, and pick up right where you left off.
        </p>
        <button
          onClick={handleGetStarted}
          disabled={signInLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors cursor-pointer shadow-lg hover:shadow-xl inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {signInLoading ? (
            <>
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </>
          ) : (
            <>
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Get Started with Google
            </>
          )}
        </button>

        {/* Terms agreement */}
        <p className="mt-3 text-sm text-gray-600">
          By using ReadEz, you agree to our{' '}
          <Link to="/legal" onClick={() => trackEvent('landing_terms_clicked', { context: 'hero' })} className="text-blue-600 hover:text-blue-700 underline">
            Terms & Privacy
          </Link>
        </p>

        {/* Device compatibility notice */}
        <div className="mt-8 flex flex-col items-center gap-2">
          {/* Desktop/tablet message - hidden on mobile */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 bg-white/70 backdrop-blur-sm rounded-full px-4 py-2">
            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Best experienced on <strong>desktop</strong> and <strong>tablets</strong></span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-400">Mobile support coming soon</span>
          </div>
          {/* Mobile message - shown only on mobile */}
          <div className="flex sm:hidden items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-4 py-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>Mobile support <strong>coming soon</strong> — try us on a desktop or tablet!</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-16">
            Everything You Need for Seamless Reading
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Universal Ebook Library</h4>
              <p className="text-gray-600">
                Upload and organize your ebook collection in one secure place. Supports PDF, EPUB, and more formats.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Cross-Device Sync</h4>
              <p className="text-gray-600">
                Sign in with Google and your reading progress automatically syncs across all your devices.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Reading Progress Tracking</h4>
              <p className="text-gray-600">
                Never lose your place. ReadEz remembers exactly where you left off in every book.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="text-center">
              <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Distraction-Free Reader</h4>
              <p className="text-gray-600">
                Clean, modern interface designed for comfortable reading. Adjust zoom levels to your preference.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section id="readez-in-action" className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-16">
            See ReadEz in Action
          </h3>
          <div className="space-y-16">
            {/* Library Screenshot */}
            <div className="text-center">
              <h4 className="text-2xl font-semibold text-gray-900 mb-6">
                Your Personal Library
              </h4>
              <p className="text-lg text-gray-600 mb-8 max-w-3xl mx-auto">
                Organize your ebook collection with beautiful cover thumbnails. See your reading progress and last read dates at a glance.
              </p>
              <div className="rounded-lg shadow-2xl overflow-hidden border border-gray-200">
                <img
                  src="/screenshots/library.png"
                  alt="ReadEz library showing collection of books with covers"
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* Reader Screenshot */}
            <div className="text-center">
              <h4 className="text-2xl font-semibold text-gray-900 mb-6">
                Distraction-Free Reading
              </h4>
              <p className="text-lg text-gray-600 mb-8 max-w-3xl mx-auto">
                Clean, focused reading experience with adjustable zoom and easy page navigation. Your progress is saved automatically.
              </p>
              <div className="rounded-lg shadow-2xl overflow-hidden border border-gray-200">
                <img
                  src="/screenshots/reader.png"
                  alt="ReadEz PDF reader showing book page with navigation controls"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h3>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Lock in early pricing now. Premium features launch soon.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <div className="border border-gray-200 rounded-lg p-8 bg-white">
              <h4 className="text-2xl font-bold text-gray-900 mb-2">Free</h4>
              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">$0</span>
              </div>
              <p className="text-xs text-gray-500 mb-6">Forever free</p>
              <button
                onClick={handleGetStarted}
                disabled={signInLoading}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signInLoading ? 'Signing in...' : 'Get Started Free'}
              </button>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700"><strong>Core Reading</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-500"><strong>Enhanced Reading</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-500"><strong>AI-Powered</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-500"><strong>Marketplace</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-500"><strong>Analytics</strong> - Coming Soon</span>
                </li>
              </ul>
            </div>

            {/* Pro Plan */}
            <div className="border-2 border-blue-600 rounded-lg p-8 bg-white relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white text-sm font-semibold px-4 py-1 rounded-full">
                  Lock Early Price
                </span>
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-2">Pro</h4>
              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">$4.99</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-xs text-blue-600 font-medium mb-6">Price locked forever</p>
              <button
                onClick={() => handleUpgradeClick('pro')}
                disabled={loadingTier === 'pro'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingTier === 'pro' ? 'Processing...' : 'Lock in $4.99/mo'}
              </button>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700"><strong>Core Reading</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700"><strong>Enhanced Reading</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700"><strong>AI-Powered</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700"><strong>Marketplace</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700"><strong>Analytics</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-gray-700"><strong>Beta Features</strong> - Coming Soon</span>
                </li>
              </ul>
            </div>

            {/* Plus Plan */}
            <div className="border border-gray-200 rounded-lg p-8 bg-white relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gray-900 text-white text-sm font-semibold px-4 py-1 rounded-full">
                  Lock Early Price
                </span>
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-2">Plus</h4>
              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">$9.99</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-xs text-purple-600 font-medium mb-6">Price locked forever</p>
              <button
                onClick={() => handleUpgradeClick('plus')}
                disabled={loadingTier === 'plus'}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingTier === 'plus' ? 'Processing...' : 'Lock in $9.99/mo'}
              </button>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700"><strong>Core Reading</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700"><strong>Enhanced Reading</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700"><strong>AI-Powered</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700"><strong>Marketplace</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700"><strong>Analytics</strong> - Coming Soon</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="text-gray-700"><strong>Alpha Features</strong> - Coming Soon</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-white mb-6">
            Ready to Start Reading?
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            Sign in with Google and start building your digital library today.
          </p>
          <button
            onClick={handleGetStarted}
            disabled={signInLoading}
            className="bg-white hover:bg-gray-100 text-blue-600 font-semibold py-4 px-8 rounded-lg text-lg transition-colors cursor-pointer shadow-lg hover:shadow-xl inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signInLoading ? (
              <>
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Get Started with Google
              </>
            )}
          </button>

          {/* Terms agreement */}
          <p className="mt-3 text-sm text-blue-100">
            By using ReadEz, you agree to our{' '}
            <Link to="/legal" onClick={() => trackEvent('landing_terms_clicked', { context: 'cta' })} className="text-white hover:text-blue-50 underline">
              Terms & Privacy
            </Link>
          </p>
        </div>
      </section>

      {/* Open Source Contribution Section */}
      <section className="bg-gray-900 py-16 border-b border-gray-800">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 bg-green-900/30 text-green-400 text-sm font-medium rounded-full px-4 py-1.5 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Open Source
          </div>
          <h3 className="text-3xl font-bold text-white mb-4">
            Built in the Open. Contribute Today.
          </h3>
          <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
            ReadEz is fully open source. Whether you want to fix a bug, add a feature, or improve the docs — jump right in.
            Every contribution matters.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('landing_contribute_clicked')}
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              View on GitHub
            </a>
            <a
              href={`${GITHUB_REPO_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('landing_issues_clicked')}
              className="inline-flex items-center justify-center gap-2 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Browse Open Issues
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-6 text-sm">
              <Link to="/legal" className="hover:text-blue-300 transition-colors">
                Terms & Privacy
              </Link>
              <Link to="/feedback" className="hover:text-blue-300 transition-colors">
                Feedback
              </Link>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('landing_github_clicked', { context: 'footer' })}
                className="hover:text-blue-300 transition-colors"
              >
                GitHub
              </a>
            </div>
            <p className="text-sm">Open source ebook reader</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
