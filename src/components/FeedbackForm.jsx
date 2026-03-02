import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { trackEvent } from '../lib/posthog'

function FeedbackForm({ onClose }) {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('general')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  useEffect(() => {
    // Get current user and auto-fill email
    const getUser = async () => {
      try {
        const userData = await api.auth.getCurrentUser()
        if (userData) {
          setUser(userData)
          setEmail(userData.email || '')
        }
      } catch {
        // Not authenticated, that's okay
      }
    }
    getUser()
  }, [])

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ email, category, subject, description }) => {
      return await api.feedback.submit({
        category,
        subject,
        description,
        email,
      })
    },
    onSuccess: (data) => {
      setIsSubmitted(true)
      trackEvent('feedback_submitted', {
        category: data.category,
        has_subject: !!data.subject,
        description_length: data.description.length,
      })

      // Reset form and close modal after showing success message
      setTimeout(() => {
        onClose()
      }, 2000)
    },
    onError: (error) => {
      console.error('Feedback submission error:', error)
      trackEvent('feedback_submission_failed', {
        error: error.message || 'Unknown error',
      })
      toast.error(error.message || 'Failed to submit feedback')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Please enter your email')
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    if (!subject.trim()) {
      toast.error('Please enter a subject')
      return
    }

    if (!description.trim()) {
      toast.error('Please enter your feedback')
      return
    }

    trackEvent('feedback_submit_attempted', {
      category,
      subject_length: subject.length,
      description_length: description.length,
    })

    submitFeedbackMutation.mutate({ email, category, subject, description })
  }

  if (isSubmitted) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Thank You!</h3>
          <p className="text-gray-600">Your feedback has been submitted successfully.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Share Your Feedback</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your.email@example.com"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              trackEvent('feedback_category_selected', { category: e.target.value })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="general">General Query</option>
            <option value="feature">Feature Request</option>
            <option value="bug">Bug Report</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief summary of your feedback"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Please provide as much detail as possible..."
            required
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitFeedbackMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default FeedbackForm
