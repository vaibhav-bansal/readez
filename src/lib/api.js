/**
 * REST API client for ReadEz backend.
 * Replaces Supabase client for all backend operations.
 */

// Use relative paths for same-origin deployment (production)
// Fall back to localhost for local development
export const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

/**
 * Make an authenticated API request.
 * Credentials: 'include' ensures cookies are sent with requests.
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    credentials: 'include', // Send cookies for session auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Handle FormData (file uploads)
  if (options.body instanceof FormData) {
    delete defaultOptions.headers['Content-Type'];
  }

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
  });

  // Handle responses
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  // Handle empty responses
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// ============ Authentication ============

export const auth = {
  /**
   * Initiate Google OAuth login using popup.
   * 1. Fetches authorization URL from backend
   * 2. Opens popup directly to Google
   * 3. Listens for postMessage from callback
   * Returns a promise that resolves with user data when auth is complete.
   */
  async loginWithGoogle() {
    // Get authorization URL from backend
    const { authorization_url } = await apiRequest('/auth/google/login');

    // Open popup directly to Google OAuth
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authorization_url,
      'GoogleSignIn',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    if (!popup) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    // Listen for messages from popup callback
    return new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        // Accept messages from backend origin (callback returns HTML from backend)
        const allowedOrigins = [window.location.origin, API_BASE_URL];
        if (!allowedOrigins.includes(event.origin)) {
          return;
        }

        if (event.data.type === 'OAUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          resolve(event.data.user);
        } else if (event.data.type === 'OAUTH_ERROR') {
          window.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error || 'Authentication failed'));
        }
      };

      window.addEventListener('message', handleMessage);

      // Timeout after 2 minutes
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Authentication timed out'));
      }, 120000);
    });
  },

  /**
   * Get current user info.
   */
  async getCurrentUser() {
    return apiRequest('/auth/me');
  },

  /**
   * Check authentication status.
   */
  async getStatus() {
    return apiRequest('/auth/status');
  },

  /**
   * Logout - clear session.
   */
  async logout() {
    return apiRequest('/auth/logout', { method: 'POST' });
  },
};

// ============ Books ============

export const books = {
  /**
   * List all books for current user.
   */
  async list() {
    return apiRequest('/books');
  },

  /**
   * Get a specific book.
   */
  async get(bookId) {
    return apiRequest(`/books/${bookId}`);
  },

  /**
   * Upload a new book (PDF).
   */
  async upload(file, title = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }

    return apiRequest('/books', {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Delete a book.
   */
  async delete(bookId) {
    return apiRequest(`/books/${bookId}`, { method: 'DELETE' });
  },

  /**
   * Get a signed URL for accessing the PDF.
   */
  async getSignedUrl(bookId) {
    return apiRequest(`/books/${bookId}/signed-url`);
  },

  /**
   * Get the full URL for a book file using signed URL data.
   */
  getFileUrl(bookId, signedPath, expires, sig) {
    return `${API_BASE_URL}/books/${bookId}/file?expires=${expires}&sig=${sig}`;
  },

  /**
   * Get thumbnail URL for a book.
   */
  getThumbnailUrl(bookId) {
    return `${API_BASE_URL}/books/${bookId}/thumbnail`;
  },
};

// ============ Reading Progress ============

export const progress = {
  /**
   * Get all reading progress for current user.
   */
  async list() {
    return apiRequest('/progress');
  },

  /**
   * Get progress for a specific book.
   */
  async get(bookId) {
    return apiRequest(`/progress/${bookId}`);
  },

  /**
   * Update reading progress.
   */
  async update(bookId, data) {
    return apiRequest(`/progress/${bookId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ============ Subscription ============

export const subscription = {
  /**
   * Get subscription status and usage.
   */
  async get() {
    return apiRequest('/subscription');
  },

  /**
   * Get feature usage.
   */
  async getUsage() {
    return apiRequest('/subscription/usage');
  },
};

// ============ Payments ============

export const payments = {
  /**
   * Create a checkout session.
   */
  async createCheckout(tier) {
    return apiRequest('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  },
};

// ============ Feedback ============

export const feedback = {
  /**
   * Submit feedback.
   */
  async submit(data) {
    return apiRequest('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * List user's feedback submissions.
   */
  async list() {
    return apiRequest('/feedback');
  },
};

// ============ Polling Helper ============

/**
 * Poll an endpoint until a condition is met or timeout.
 * @param {Function} fetchFn - Async function to call
 * @param {Function} conditionFn - Function that returns true when polling should stop
 * @param {Object} options - Polling options
 * @param {number} options.interval - Poll interval in ms (default 2000)
 * @param {number} options.timeout - Timeout in ms (default 30000)
 * @returns {Promise<any>} - Last fetched data
 */
export async function pollUntil(fetchFn, conditionFn, options = {}) {
  const { interval = 2000, timeout = 30000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const data = await fetchFn();

    if (conditionFn(data)) {
      return data;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Polling timeout');
}

// Export all
export default {
  auth,
  books,
  progress,
  subscription,
  payments,
  feedback,
  pollUntil,
};
