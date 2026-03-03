import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import api, { API_BASE_URL } from '../lib/api'
import toast from 'react-hot-toast'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import BookCover from '../components/BookCover'
import BookCoverSkeleton from '../components/BookCoverSkeleton'
import SubscriptionBadge from '../components/SubscriptionBadge'
import SubscriptionModal from '../components/SubscriptionModal'
import { useSubscription } from '../hooks/useSubscription'
import '../lib/pdfWorker' // Ensure PDF.js worker is configured
import { generateThumbnail } from '../lib/thumbnailGenerator'
import { trackEvent } from '../lib/posthog'

function Library() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [hoveredBookId, setHoveredBookId] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState(null) // { bookId, title }
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)

  // Get current user
  const { data: userData } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const user = await api.auth.getCurrentUser()
        return user
      } catch {
        return null
      }
    },
  })

  // Get user subscription status
  const { tier, isLoading: subscriptionLoading } = useSubscription(userData?.id)

  // Fetch books with progress
  const { data: booksData, isLoading, error: booksError, refetch } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const data = await api.books.list()
      return data.books || []
    },
    retry: 2,
  })

  // Fetch reading progress for all books
  const { data: progressData } = useQuery({
    queryKey: ['progress'],
    queryFn: async () => {
      const data = await api.progress.list()
      return data.progress || []
    },
    enabled: !!userData?.id,
  })

  // Merge books with progress
  const books = booksData?.map(book => {
    const progress = progressData?.find(p => p.book_id === book.id)
    return {
      ...book,
      current_page: progress?.current_page || null,
      last_read_at: progress?.last_read_at || null,
      zoom_level: progress?.zoom_level || null,
    }
  }) || []

  // Generate thumbnail URLs for books
  const { data: coverUrlMap, isLoading: coverUrlsLoading } = useQuery({
    queryKey: ['coverUrls', booksData],
    queryFn: async () => {
      if (!booksData?.length) return {}

      const urlMap = {}
      booksData.forEach((book) => {
        // Use thumbnail_url from API response if available
        if (book.thumbnail_url) {
          urlMap[book.id] = `${API_BASE_URL}${book.thumbnail_url}`
        }
      })
      return urlMap
    },
    enabled: !!booksData?.length,
    retry: 2,
  })

  // Delete book mutation
  const deleteBookMutation = useMutation({
    mutationFn: async (bookId) => {
      const book = booksData?.find(b => b.id === bookId)
      await api.books.delete(bookId)
      return book
    },
    onSuccess: (book) => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['progress'] })
      toast.success('Book deleted successfully')
      setDeleteConfirmation(null)

      trackEvent('book_deleted', {
        book_id: book?.id,
        file_size: book?.file_size,
      })
    },
    onError: (error, bookId) => {
      toast.error(error.message || 'Failed to delete book')
      trackEvent('book_delete_failed', {
        book_id: bookId,
        error: error.message || 'Unknown error',
      })
    },
  })

  const handleDeleteClick = (e, bookId, bookTitle) => {
    e.stopPropagation() // Prevent navigation
    trackEvent('book_delete_clicked', {
      book_id: bookId,
    })
    setDeleteConfirmation({ bookId, title: bookTitle })
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirmation) {
      trackEvent('book_delete_confirmed', {
        book_id: deleteConfirmation.bookId,
      })
      deleteBookMutation.mutate(deleteConfirmation.bookId)
      setDeleteConfirmation(null)
    }
  }

  const handleDeleteCancel = () => {
    if (deleteConfirmation) {
      trackEvent('book_delete_cancelled', {
        book_id: deleteConfirmation.bookId,
      })
    }
    setDeleteConfirmation(null)
  }

  useEffect(() => {
    if (booksError) {
      toast.error('Failed to load library')
    }
  }, [booksError])

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (deleteConfirmation) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [deleteConfirmation])

  const onDrop = async (acceptedFiles) => {
    const pdfFile = acceptedFiles.find(file => file.type === 'application/pdf')
    if (!pdfFile) {
      trackEvent('book_upload_rejected', {
        reason: 'not_pdf',
      })
      toast.error('Please upload a PDF file')
      return
    }

    // Track upload start
    trackEvent('book_upload_started', {
      file_size: pdfFile.size,
    })

    setUploading(true)
    try {
      // Upload via API (backend handles storage)
      const bookData = await api.books.upload(pdfFile)

      // Try to generate and upload thumbnail
      // Note: For now, thumbnail generation happens client-side
      // In future, this could be moved to backend
      let thumbnailGenerated = false
      try {
        const thumbnailBlob = await generateThumbnail(pdfFile)
        // TODO: Add thumbnail upload endpoint to backend
        // For now, thumbnail is generated when PDF is first opened
        thumbnailGenerated = true
      } catch (thumbnailError) {
        console.warn('Thumbnail generation error:', thumbnailError)
      }

      // Track successful upload
      trackEvent('book_uploaded', {
        book_id: bookData.id,
        file_size: pdfFile.size,
        thumbnail_generated: thumbnailGenerated,
      })

      toast.success('Book uploaded successfully!')
      refetch()
    } catch (error) {
      console.error('Upload error:', error)
      trackEvent('book_upload_failed', {
        file_size: pdfFile.size,
        error: error.message || 'Unknown error',
      })
      toast.error(error.message || 'Failed to upload book')
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: uploading,
  })

  // Show skeleton loaders while loading
  const showSkeletons = isLoading || coverUrlsLoading

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with title and subscription badge */}
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-3xl font-bold">My Library</h1>
          {!subscriptionLoading && <SubscriptionBadge tier={tier} />}
        </div>

        {/* Upload area */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer mb-8 transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="w-full">
              <p>Uploading PDF...</p>
              <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          ) : isDragActive ? (
            <p>Drop the PDF here...</p>
          ) : (
            <p>Drag & drop a PDF here, or click to select</p>
          )}
        </div>

        {/* Books grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {showSkeletons ? (
            // Show skeleton loaders while loading
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="bg-white rounded-lg shadow-md overflow-hidden"
                style={{ aspectRatio: '2/3' }}
              >
                {/* Skeleton Cover */}
                <div className="w-full h-3/4 overflow-hidden">
                  <BookCoverSkeleton className="w-full h-full" />
                </div>

                {/* Skeleton Info */}
                <div className="p-3 h-1/4 flex flex-col justify-between bg-white">
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-20"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-24"></div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            // Sort books by most recent date (either created_at or last_read_at, whichever is more recent)
            (() => {
              const sortedBooks = [...(books || [])]
              sortedBooks.sort((a, b) => {
                // Get the most recent date for each book
                const aMostRecent = a.last_read_at
                  ? Math.max(new Date(a.created_at), new Date(a.last_read_at))
                  : new Date(a.created_at)

                const bMostRecent = b.last_read_at
                  ? Math.max(new Date(b.created_at), new Date(b.last_read_at))
                  : new Date(b.created_at)

                // Sort by most recent date in descending order (newest first)
                return bMostRecent - aMostRecent
              })
              return sortedBooks
            })().map((book) => {
              const coverUrl = coverUrlMap?.[book.id] || null
              const lastReadAt = book.last_read_at
              // Show skeleton for cover if URL is not yet loaded (only if thumbnail exists)
              const isCoverLoading = book.thumbnail_url && !coverUrl

              return (
                <div
                  key={book.id}
                  onMouseEnter={() => setHoveredBookId(book.id)}
                  onMouseLeave={() => setHoveredBookId(null)}
                  className="group relative bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200"
                  style={{ aspectRatio: '2/3' }}
                  onClick={() => {
                    trackEvent('book_opened', {
                      book_id: book.id,
                      current_page: book.current_page || null,
                      has_progress: !!book.current_page,
                    })
                    navigate(`/library/${book.id}`)
                  }}
                >
                  {/* Delete button - appears on hover */}
                  {hoveredBookId === book.id && (
                    <button
                      onClick={(e) => handleDeleteClick(e, book.id, book.title)}
                      className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-all duration-200"
                      title="Delete book"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}

                  {/* Book Cover */}
                  <div className="w-full h-3/4 overflow-hidden">
                    {isCoverLoading ? (
                      <BookCoverSkeleton className="w-full h-full" />
                    ) : (
                      <BookCover
                        coverUrl={coverUrl}
                        title={book.title}
                        className="w-full h-full"
                      />
                    )}
                  </div>

                  {/* Book Info */}
                  <div className="p-3 h-1/4 flex flex-col justify-between bg-white">
                    <h2 className="text-sm font-semibold mb-1 line-clamp-2" title={book.title}>
                      {book.title}
                    </h2>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      {book.total_pages && (
                        <p className="text-gray-500">{book.total_pages} pages</p>
                      )}
                      {lastReadAt ? (
                        <p className="text-gray-400">
                          Last read: {format(new Date(lastReadAt), 'MMM d, yyyy')}
                        </p>
                      ) : book.created_at && (
                        <p className="text-gray-400">
                          Uploaded: {format(new Date(book.created_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {books?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No books yet. Upload a PDF to get started!
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <div className="flex gap-4 justify-center">
            <Link to="/legal" className="hover:text-gray-700 transition-colors">
              Terms & Privacy
            </Link>
            <Link to="/feedback" className="hover:text-gray-700 transition-colors">
              Feedback
            </Link>
          </div>
        </footer>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation && (
        <>
          {/* Backdrop overlay - darkens and blurs the background */}
          <div
            className="fixed inset-0 z-40 transition-opacity duration-200"
            onClick={handleDeleteCancel}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              animation: 'fadeIn 0.2s ease-in-out'
            }}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div
              className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 pointer-events-auto transform transition-all duration-200"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: 'fadeInScale 0.2s ease-in-out' }}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Delete Book</h3>
                <p className="text-gray-700 mb-6">
                  Are you sure you want to delete <span className="font-semibold">"{deleteConfirmation.title}"</span>?
                  This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleDeleteCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleteBookMutation.isPending}
                    className="px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteBookMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        currentTier={tier}
      />
    </div>
  )
}

export default Library
