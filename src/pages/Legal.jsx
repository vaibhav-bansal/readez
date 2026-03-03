import { Link } from 'react-router-dom'

const GITHUB_REPO_URL = 'https://github.com/vaibhav-bansal/readez'

function Legal() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-gray-900">
            ReadEz
          </Link>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-700 hover:text-gray-900 transition-colors"
            aria-label="View on GitHub"
            title="View on GitHub"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8 sm:p-12">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service & Privacy Policy</h1>
            <p className="text-gray-600">
              Last Updated: January 30, 2026
            </p>
          </div>

          {/* Section 1: About These Terms */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. About These Terms</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Welcome to ReadEz! We believe in keeping things simple and transparent. This document explains
              how our service works, what information we collect, and how we use it.
            </p>
            <p className="text-gray-700 leading-relaxed">
              By using ReadEz, you agree to these terms. If you don't agree, please don't use our service.
            </p>
          </section>

          {/* Section 2: The Service */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. The Service</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ReadEz is a free, open-source ebook reader that lets you upload, read, and sync your ebooks
              (PDFs, EPUBs, and more) across all your devices. We use Google Sign-in for authentication
              to make it easy and secure for you to access your library.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Our code is open source under the ISC license, which means anyone can view, use, and
              contribute to it on{' '}
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                GitHub
              </a>.
            </p>
          </section>

          {/* Section 3: Your Content & Responsibilities */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Your Content & Responsibilities</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>You own your ebooks.</strong> When you upload an ebook to ReadEz, you still own it.
              We just store it securely so you can access it from any device. By uploading content, you
              give us permission to store and display it for you as part of the service.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Your responsibility:</strong> You're responsible for making sure you have the right
              to upload and share any content you add to ReadEz. Please don't upload:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4 mb-4">
              <li>Illegal content or pirated ebooks</li>
              <li>Malware, viruses, or harmful files</li>
              <li>Content that violates others' rights</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Don't try to hack, abuse, or misuse our service. We can terminate accounts that violate
              these rules.
            </p>
          </section>

          {/* Section 4: Information We Collect */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Information We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              To provide ReadEz, we collect the following information:
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Account Information</h3>
                <p className="text-gray-700 leading-relaxed">
                  When you sign in with Google, we receive your email address, name, and profile picture.
                  This helps us identify you and personalize your experience.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Your Ebooks</h3>
                <p className="text-gray-700 leading-relaxed">
                  We store the ebooks you upload (PDFs, EPUBs, etc.) along with basic information like
                  the file name, size, and number of pages.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Reading Progress</h3>
                <p className="text-gray-700 leading-relaxed">
                  We save which page you're on and your scroll position so you can pick up right where
                  you left off on any device. We also track when you last read each book.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Analytics & Usage Data</h3>
                <p className="text-gray-700 leading-relaxed">
                  We use PostHog to understand how people use ReadEz and improve the experience. This
                  includes page views, clicks, session recordings (screen activity), device type, browser
                  information, and IP address. Session recordings help us see how users interact with the
                  app so we can fix bugs and improve usability.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: How We Use & Store Your Information */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. How We Use & Store Your Information</h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">What We Do With Your Data</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Provide and maintain the ReadEz service</li>
                  <li>Sync your reading progress across devices</li>
                  <li>Authenticate you when you sign in</li>
                  <li>Analyze how people use the app to make it better</li>
                  <li>Fix bugs and improve performance</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Security & Storage</h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  Your data is stored securely on Supabase with encryption and row-level security. All
                  connections use HTTPS to keep your information safe.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  <strong>We don't sell your data.</strong> We'll never sell your personal information or
                  ebooks to third parties.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Third-Party Services</h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  To provide ReadEz, we use these trusted services:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>
                    <strong>Railway</strong> - Backend hosting, database, and file storage (
                    <a
                      href="https://railway.app/legal/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      Privacy Policy
                    </a>)
                  </li>
                  <li>
                    <strong>PostHog</strong> - Analytics and session recordings (
                    <a
                      href="https://posthog.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      Privacy Policy
                    </a>)
                  </li>
                  <li>
                    <strong>Google</strong> - OAuth authentication (
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      Privacy Policy
                    </a>)
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 6: Cookies & Tracking */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Cookies & Tracking</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use cookies and similar technologies to make ReadEz work:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>
                <strong>Authentication cookies</strong> - Keep you signed in (Supabase)
              </li>
              <li>
                <strong>Analytics cookies</strong> - Track how you use the app (PostHog)
              </li>
              <li>
                <strong>Session storage</strong> - Remember your preferences like zoom level
              </li>
            </ul>
          </section>

          {/* Section 7: Legal Stuff */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Legal Stuff</h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Service "As Is"</h3>
                <p className="text-gray-700 leading-relaxed">
                  ReadEz is provided "as is" without warranties of any kind. We work hard to keep it
                  running smoothly, but we can't guarantee it will always be available or error-free.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Limitation of Liability</h3>
                <p className="text-gray-700 leading-relaxed">
                  To the maximum extent permitted by law, we're not liable for any damages arising from
                  your use of ReadEz, including lost data or interrupted service.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Account Termination</h3>
                <p className="text-gray-700 leading-relaxed">
                  We reserve the right to terminate accounts that violate these terms or misuse the service.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Legal Requirements</h3>
                <p className="text-gray-700 leading-relaxed">
                  We may share your information if required by law, such as in response to a valid court
                  order or legal process.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8: Contact Us */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Have questions about these terms or our privacy practices? We're here to help!
            </p>
            <Link
              to="/feedback"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Submit Feedback or Questions
            </Link>
          </section>

          {/* Footer Note */}
          <div className="mt-12 pt-8 border-t border-gray-200 text-center">
            <p className="text-gray-600 text-sm">
              ReadEz is open source. View our code on{' '}
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                GitHub
              </a>.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-6">
              <Link to="/legal" className="hover:text-blue-300 transition-colors">
                Terms & Privacy
              </Link>
              <Link to="/feedback" className="hover:text-blue-300 transition-colors">
                Help & Feedback
              </Link>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
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

export default Legal
