import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// Import worker config FIRST - this sets up pdfjs before Document/Page are used
import { pdfWorkerSrc } from '../lib/pdfWorker'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
import api, { API_BASE_URL } from '../lib/api'
import toast from 'react-hot-toast'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { useProgressStore } from '../store/progressStore'
import BookLoadingScreen from '../components/BookLoadingScreen'
import { trackEvent } from '../lib/posthog'

function Reader() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.5)
  const [isCalculatingZoom, setIsCalculatingZoom] = useState(true)
  const [showPageJumpModal, setShowPageJumpModal] = useState(false)
  const [pageJumpInput, setPageJumpInput] = useState('')
  const pageHeightRef = useRef(null)
  const lastSavedPageRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const touchEndRef = useRef({ x: 0, y: 0 })

  const { setProgress } = useProgressStore()

  // Navigation functions
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      trackEvent('page_navigated', {
        book_id: bookId,
        page: currentPage - 1,
        method: 'previous_button',
      })
      setCurrentPage(prev => prev - 1)
    }
  }

  const goToNextPage = () => {
    if (currentPage < numPages) {
      trackEvent('page_navigated', {
        book_id: bookId,
        page: currentPage + 1,
        method: 'next_button',
      })
      setCurrentPage(prev => prev + 1)
    }
  }

  const goToFirstPage = () => {
    trackEvent('page_navigated', {
      book_id: bookId,
      page: 1,
      method: 'first_page',
    })
    setCurrentPage(1)
  }

  const goToLastPage = () => {
    if (numPages) {
      trackEvent('page_navigated', {
        book_id: bookId,
        page: numPages,
        method: 'last_page',
      })
      setCurrentPage(numPages)
    }
  }

  const handlePageJump = () => {
    const pageNum = parseInt(pageJumpInput, 10)
    if (pageNum && pageNum >= 1 && pageNum <= numPages) {
      trackEvent('page_jumped', {
        book_id: bookId,
        page: pageNum,
        method: 'page_jump_modal',
      })
      setCurrentPage(pageNum)
      setShowPageJumpModal(false)
      setPageJumpInput('')
    } else {
      trackEvent('page_jump_failed', {
        book_id: bookId,
        attempted_page: pageJumpInput,
        reason: 'invalid_page_number',
      })
      toast.error(`Please enter a page number between 1 and ${numPages}`)
    }
  }

  // Fetch book data
  const { data: book, isLoading: bookLoading, error: bookError } = useQuery({
    queryKey: ['book', bookId],
    queryFn: async () => {
      return await api.books.get(bookId)
    },
    enabled: !!bookId,
    retry: 2,
  })

  useEffect(() => {
    if (bookError) {
      console.error('Book load error:', bookError)
      toast.error(bookError.message || 'Failed to load book')
    }
  }, [bookError])

  // Get PDF signed URL
  const { data: signedUrlData, error: pdfUrlError, isLoading: pdfUrlLoading } = useQuery({
    queryKey: ['pdfUrl', book?.id],
    queryFn: async () => {
      if (!book?.id) return null
      return await api.books.getSignedUrl(book.id)
    },
    enabled: !!book?.id,
    retry: 2,
  })

  // Fetch PDF as base64-encoded JSON, then convert to blob URL
  // This bypasses IDM which intercepts direct file downloads
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [pdfLoadError, setPdfLoadError] = useState(null)

  useEffect(() => {
    if (!signedUrlData?.signed_url) {
      setPdfBlobUrl(null)
      return
    }

    // Convert /file endpoint to /data endpoint
    const dataUrl = signedUrlData.signed_url.replace('/file?', '/data?')
    const fullUrl = `${API_BASE_URL}${dataUrl}`

    let objectUrl = null
    fetch(fullUrl, { credentials: 'include' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        // Decode base64 to binary
        const binaryString = atob(data.data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        // Create blob from binary data
        const blob = new Blob([bytes], { type: data.mime_type || 'application/pdf' })
        objectUrl = URL.createObjectURL(blob)
        setPdfBlobUrl(objectUrl)
        setPdfLoadError(null)
      })
      .catch(error => {
        console.error('PDF fetch error:', error)
        setPdfLoadError(error)
        setPdfBlobUrl(null)
      })

    // Cleanup blob URL on unmount or when URL changes
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [signedUrlData])

  useEffect(() => {
    if (pdfUrlError) {
      console.error('PDF URL error:', pdfUrlError)
      toast.error(`Failed to load PDF file: ${pdfUrlError.message || 'Unknown error'}`)
    }
  }, [pdfUrlError])

  useEffect(() => {
    if (pdfLoadError) {
      console.error('PDF load error:', pdfLoadError)
      toast.error(`Failed to load PDF file: ${pdfLoadError.message || 'Unknown error'}`)
    }
  }, [pdfLoadError])

  // Fetch reading progress
  const { data: readingProgress, isLoading: readingProgressLoading } = useQuery({
    queryKey: ['readingProgress', bookId],
    queryFn: async () => {
      try {
        return await api.progress.get(bookId)
      } catch (error) {
        // Not found is okay - means no progress yet
        if (error.message?.includes('not found')) {
          return null
        }
        throw error
      }
    },
    enabled: !!bookId,
    staleTime: 0,
    gcTime: 0,
  })

  // Restore saved zoom level when reading progress loads
  useEffect(() => {
    if (readingProgress?.zoom_level && isCalculatingZoom) {
      // Handle both percentage (150) and float (1.5) formats
      const zoomValue = readingProgress.zoom_level
      const restoredScale = zoomValue > 10 ? zoomValue / 100 : zoomValue
      setScale(restoredScale)
      setIsCalculatingZoom(false)
    }
  }, [readingProgress?.zoom_level, isCalculatingZoom])

  // Restore page when readingProgress loads
  useEffect(() => {
    if (readingProgress?.current_page && !hasRestoredRef.current && !numPages) {
      console.log('Setting initial page from readingProgress:', readingProgress.current_page)
      setCurrentPage(readingProgress.current_page)
    }
  }, [readingProgress?.current_page, numPages])

  // Sync progress mutation
  const syncProgressMutation = useMutation({
    mutationFn: async ({ page, zoomLevel }) => {
      console.log('Syncing progress:', { page, zoomLevel, bookId })

      const updateData = {
        current_page: page,
        last_read_at: new Date().toISOString(),
      }

      if (zoomLevel !== undefined) {
        updateData.zoom_level = zoomLevel
      }

      return await api.progress.update(bookId, updateData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingProgress', bookId] })
      queryClient.invalidateQueries({ queryKey: ['progress'] })
    },
    onError: (error) => {
      console.error('Progress sync error:', error)
    },
    retry: 1,
  })

  // Save zoom level mutation (debounced)
  const saveZoomMutation = useMutation({
    mutationFn: async (zoomLevel) => {
      const updateData = {
        zoom_level: zoomLevel,
        last_read_at: new Date().toISOString(),
      }

      if (readingProgress?.current_page) {
        updateData.current_page = readingProgress.current_page
      }

      return await api.progress.update(bookId, updateData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingProgress', bookId] })
    },
    onError: (error) => {
      console.error('Zoom save error:', error)
    },
    retry: 1,
  })

  const hasRestoredRef = useRef(false)
  const progressSyncTimeoutRef = useRef(null)
  const pendingSaveRef = useRef(null)

  // Reset restoration ref when bookId changes
  useEffect(() => {
    hasRestoredRef.current = false
    lastSavedPageRef.current = null
    pendingSaveRef.current = null
    setCurrentPage(1)
  }, [bookId])

  const onDocumentLoadSuccess = ({ numPages: totalPages }) => {
    setNumPages(totalPages)

    // Track PDF loaded
    trackEvent('pdf_loaded', {
      book_id: bookId,
      total_pages: totalPages,
      has_saved_progress: !!readingProgress?.current_page,
    })

    // Restore reading position if available
    if (readingProgress?.current_page && !hasRestoredRef.current) {
      const targetPage = Math.min(Math.max(1, readingProgress.current_page), totalPages)
      console.log('Restoring to page:', targetPage)
      setCurrentPage(targetPage)
      hasRestoredRef.current = true
    } else if (!readingProgress?.current_page && !hasRestoredRef.current) {
      hasRestoredRef.current = true
      lastSavedPageRef.current = 1
    }
  }

  // Handle restoration when readingProgress loads after document
  useEffect(() => {
    if (numPages && readingProgress?.current_page && !hasRestoredRef.current) {
      const targetPage = Math.min(Math.max(1, readingProgress.current_page), numPages)
      console.log('Restoring to page from useEffect:', targetPage)
      setCurrentPage(targetPage)
      hasRestoredRef.current = true
    } else if (numPages && !readingProgress?.current_page && !hasRestoredRef.current) {
      console.log('No saved progress, starting at page 1')
      setCurrentPage(1)
      lastSavedPageRef.current = 1
      hasRestoredRef.current = true
    }
  }, [numPages, readingProgress?.current_page])

  // Handle page load success - calculate fit-to-height zoom
  const onPageLoadSuccess = (pageNum) => {
    if (pageNum === 1 && isCalculatingZoom && !readingProgress?.zoom_level) {
      setTimeout(() => {
        try {
          const pageElement = document.getElementById(`page-${pageNum}`)
          if (pageElement) {
            const canvas = pageElement.querySelector('canvas')
            if (canvas) {
              const renderedHeight = canvas.offsetHeight
              const pageHeightAtScale1 = renderedHeight / scale
              pageHeightRef.current = pageHeightAtScale1

              const headerHeight = 80
              const padding = 32
              const availableHeight = window.innerHeight - headerHeight - padding

              const fitToHeightScale = availableHeight / pageHeightAtScale1
              setScale(fitToHeightScale)
              setIsCalculatingZoom(false)
            }
          }
        } catch (error) {
          console.error('Error calculating fit-to-height zoom:', error)
          setIsCalculatingZoom(false)
        }
      }, 100)
    }
  }

  const onDocumentLoadError = (error) => {
    console.error('PDF load error:', error)
    toast.error(`Failed to load PDF document: ${error.message || 'Unknown error'}`)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          if (currentPage > 1) {
            trackEvent('page_navigated', {
              book_id: bookId,
              page: currentPage - 1,
              method: 'keyboard_arrow_left',
            })
            setCurrentPage(prev => prev - 1)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (currentPage < numPages) {
            trackEvent('page_navigated', {
              book_id: bookId,
              page: currentPage + 1,
              method: 'keyboard_arrow_right',
            })
            setCurrentPage(prev => prev + 1)
          }
          break
        case ' ':
          e.preventDefault()
          if (currentPage < numPages) {
            trackEvent('page_navigated', {
              book_id: bookId,
              page: currentPage + 1,
              method: 'keyboard_space',
            })
            setCurrentPage(prev => prev + 1)
          }
          break
        case 'Home':
          e.preventDefault()
          trackEvent('page_navigated', {
            book_id: bookId,
            page: 1,
            method: 'keyboard_home',
          })
          setCurrentPage(1)
          break
        case 'End':
          e.preventDefault()
          if (numPages) {
            trackEvent('page_navigated', {
              book_id: bookId,
              page: numPages,
              method: 'keyboard_end',
            })
            setCurrentPage(numPages)
          }
          break
        case 'g':
        case 'G':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            trackEvent('page_jump_modal_opened', {
              book_id: bookId,
              method: 'keyboard_g',
            })
            setShowPageJumpModal(true)
          }
          break
        default:
          if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.metaKey) {
            if (showPageJumpModal) {
              setPageJumpInput(prev => prev + e.key)
            } else {
              setPageJumpInput(e.key)
              setShowPageJumpModal(true)
            }
          }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, numPages, showPageJumpModal])

  // Touch/swipe gestures
  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }

    const handleTouchEnd = (e) => {
      touchEndRef.current = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
      }

      const deltaX = touchEndRef.current.x - touchStartRef.current.x
      const deltaY = touchEndRef.current.y - touchStartRef.current.y
      const minSwipeDistance = 50

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0 && currentPage > 1) {
          trackEvent('page_navigated', {
            book_id: bookId,
            page: currentPage - 1,
            method: 'swipe_right',
          })
          setCurrentPage(prev => prev - 1)
        } else if (deltaX < 0 && currentPage < numPages) {
          trackEvent('page_navigated', {
            book_id: bookId,
            page: currentPage + 1,
            method: 'swipe_left',
          })
          setCurrentPage(prev => prev + 1)
        }
      }
      else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > minSwipeDistance) {
        if (deltaY > 0 && currentPage > 1) {
          trackEvent('page_navigated', {
            book_id: bookId,
            page: currentPage - 1,
            method: 'swipe_down',
          })
          setCurrentPage(prev => prev - 1)
        } else if (deltaY < 0 && currentPage < numPages) {
          trackEvent('page_navigated', {
            book_id: bookId,
            page: currentPage + 1,
            method: 'swipe_up',
          })
          setCurrentPage(prev => prev + 1)
        }
      }
    }

    const container = document.querySelector('.min-h-screen')
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: true })
      container.addEventListener('touchend', handleTouchEnd, { passive: true })
      return () => {
        container.removeEventListener('touchstart', handleTouchStart)
        container.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [currentPage, numPages])

  // Save progress when page changes
  useEffect(() => {
    const shouldSave = currentPage &&
                      numPages &&
                      currentPage !== lastSavedPageRef.current &&
                      currentPage !== pendingSaveRef.current &&
                      hasRestoredRef.current

    if (shouldSave) {
      pendingSaveRef.current = currentPage
      setProgress(bookId, currentPage)

      if (progressSyncTimeoutRef.current) {
        clearTimeout(progressSyncTimeoutRef.current)
        progressSyncTimeoutRef.current = null
      }

      progressSyncTimeoutRef.current = setTimeout(() => {
        syncProgressMutation.mutate(
          { page: currentPage, zoomLevel: Math.round(scale * 100) }, // Convert scale to percentage
          {
            onSuccess: () => {
              trackEvent('reading_progress_saved', {
                book_id: bookId,
                page: currentPage,
                zoom_level: scale,
                progress_percentage: numPages ? Math.round((currentPage / numPages) * 100) : null,
              })
              lastSavedPageRef.current = currentPage
              pendingSaveRef.current = null
              progressSyncTimeoutRef.current = null
            },
            onError: (error) => {
              console.error('Failed to save progress:', error)
              toast.error('Failed to save reading progress: ' + (error.message || 'Unknown error'))
              pendingSaveRef.current = null
              progressSyncTimeoutRef.current = null
            }
          }
        )
      }, 500)
    }

    return () => {
      if (progressSyncTimeoutRef.current) {
        clearTimeout(progressSyncTimeoutRef.current)
        progressSyncTimeoutRef.current = null
      }
    }
  }, [currentPage, numPages, bookId, scale])

  const showLoadingScreen = bookLoading || pdfUrlLoading || !pdfBlobUrl

  const documentOptions = useMemo(() => ({
    workerSrc: pdfWorkerSrc,
  }), [])

  if (showLoadingScreen) {
    return <BookLoadingScreen messageIndex={0} />
  }

  if (bookError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Failed to load book: {bookError.message}</div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Book not found</div>
      </div>
    )
  }

  if (pdfLoadError || pdfUrlError) {
    const error = pdfLoadError || pdfUrlError
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Failed to load PDF: {error?.message || 'Unknown error'}</div>
      </div>
    )
  }

  if (!pdfBlobUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">PDF file not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              trackEvent('reader_exited', {
                book_id: bookId,
                current_page: currentPage,
                zoom_level: scale,
                progress_percentage: numPages ? Math.round((currentPage / numPages) * 100) : null,
              })
              navigate('/library')
            }}
            className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
          >
            ← Back to Library
          </button>
          <h1 className="text-lg font-semibold truncate flex-1 mx-4">{book.title}</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const newScale = Math.max(0.5, scale - 0.25)
                trackEvent('zoom_changed', {
                  book_id: bookId,
                  zoom_level: newScale,
                  method: 'zoom_out_button',
                })
                setScale(newScale)
                clearTimeout(window.zoomSaveTimeout)
                window.zoomSaveTimeout = setTimeout(() => {
                  saveZoomMutation.mutate(Math.round(newScale * 100)) // Convert scale to percentage
                }, 500)
              }}
              className="px-3 py-1 bg-gray-200 rounded-sm hover:bg-gray-300 cursor-pointer"
            >
              −
            </button>
            <span className="text-sm">{(scale * 100).toFixed(0)}%</span>
            <button
              onClick={() => {
                const newScale = Math.min(3, scale + 0.25)
                trackEvent('zoom_changed', {
                  book_id: bookId,
                  zoom_level: newScale,
                  method: 'zoom_in_button',
                })
                setScale(newScale)
                clearTimeout(window.zoomSaveTimeout)
                window.zoomSaveTimeout = setTimeout(() => {
                  saveZoomMutation.mutate(Math.round(newScale * 100)) // Convert scale to percentage
                }, 500)
              }}
              className="px-3 py-1 bg-gray-200 rounded-sm hover:bg-gray-300 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer - Centered Single Page */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div className="max-w-full">
          {pdfBlobUrl && (
            <Document
              file={pdfBlobUrl}
              options={documentOptions}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="text-center py-12">
                  <div className="text-lg">Loading PDF...</div>
                </div>
              }
              error={
                <div className="text-center py-12 text-red-600">
                  <div className="text-lg mb-2">Failed to load PDF</div>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              }
              className="flex justify-center"
            >
              {numPages && currentPage && (
                <div id={`page-${currentPage}`} className="shadow-lg">
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    onLoadSuccess={() => onPageLoadSuccess(currentPage)}
                    loading={
                      <div className="text-center py-8">
                        <div className="text-sm text-gray-500">Loading page {currentPage}...</div>
                      </div>
                    }
                    className="max-w-full h-auto"
                  />
                </div>
              )}
            </Document>
          )}
        </div>
      </div>

      {/* Footer with Navigation Controls */}
      <div className="bg-white border-t sticky bottom-0 z-10 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium min-w-[100px]"
            >
              ← Previous
            </button>

            <div className="flex items-center gap-3 flex-1 justify-center">
              <button
                onClick={() => {
                  trackEvent('page_jump_modal_opened', {
                    book_id: bookId,
                    method: 'page_info_click',
                  })
                  setShowPageJumpModal(true)
                }}
                className="text-sm text-gray-700 hover:text-blue-600 font-medium px-3 py-1 rounded hover:bg-gray-100 transition-colors"
              >
                Page {currentPage} of {numPages || '...'}
                {numPages && (
                  <span className="ml-2 text-gray-500">
                    ({Math.round((currentPage / numPages) * 100)}%)
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={goToNextPage}
              disabled={!numPages || currentPage >= numPages}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium min-w-[100px]"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Page Jump Modal */}
      {showPageJumpModal && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => {
              trackEvent('page_jump_modal_closed', {
                book_id: bookId,
                method: 'backdrop_click',
              })
              setShowPageJumpModal(false)
              setPageJumpInput('')
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div
              className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Go to Page</h3>
              <div className="mb-4">
                <input
                  type="number"
                  min="1"
                  max={numPages || 1}
                  value={pageJumpInput}
                  onChange={(e) => setPageJumpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePageJump()
                    } else if (e.key === 'Escape') {
                      setShowPageJumpModal(false)
                      setPageJumpInput('')
                    }
                  }}
                  placeholder={`Enter page (1-${numPages || '...'})`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  autoFocus
                />
                {numPages && (
                  <p className="text-sm text-gray-500 mt-2">
                    Total pages: {numPages}
                  </p>
                )}
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    trackEvent('page_jump_modal_closed', {
                      book_id: bookId,
                      method: 'cancel_button',
                    })
                    setShowPageJumpModal(false)
                    setPageJumpInput('')
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePageJump}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Reader
