/**
 * MCP Video - Web Interface Client
 * Wizard-based UI with horizontal slides
 */

// DOM Elements
const elements = {
  // Wizard
  wizardSlides: document.getElementById('wizardSlides'),
  steps: document.querySelectorAll('.step'),

  // Slide 1: Upload
  dropZone: document.getElementById('dropZone'),
  dropZoneContent: document.getElementById('dropZoneContent'),
  fileInput: document.getElementById('fileInput'),
  videoPreview: document.getElementById('videoPreview'),
  previewThumbnail: document.getElementById('previewThumbnail'),
  previewDuration: document.getElementById('previewDuration'),
  previewFilename: document.getElementById('previewFilename'),
  previewResolution: document.getElementById('previewResolution'),
  previewDurationText: document.getElementById('previewDurationText'),
  previewSize: document.getElementById('previewSize'),
  previewCodec: document.getElementById('previewCodec'),
  previewFps: document.getElementById('previewFps'),
  previewAudio: document.getElementById('previewAudio'),
  previewPath: document.getElementById('previewPath'),
  btnClearFile: document.getElementById('btnClearFile'),
  btnCopyPath: document.getElementById('btnCopyPath'),
  btnNextToOptions: document.getElementById('btnNextToOptions'),
  videoPath: document.getElementById('videoPath'),

  // Slide 2: Options
  interval: document.getElementById('interval'),
  maxFrames: document.getElementById('maxFrames'),
  quality: document.getElementById('quality'),
  width: document.getElementById('width'),
  startTime: document.getElementById('startTime'),
  endTime: document.getElementById('endTime'),
  btnBackToUpload: document.getElementById('btnBackToUpload'),
  btnExtract: document.getElementById('btnExtract'),

  // Slide 3: Results
  frameCount: document.getElementById('frameCount'),
  extractionSummary: document.getElementById('extractionSummary'),
  frameGallery: document.getElementById('frameGallery'),
  pagination: document.getElementById('pagination'),
  btnPrevPage: document.getElementById('btnPrevPage'),
  btnNextPage: document.getElementById('btnNextPage'),
  currentPage: document.getElementById('currentPage'),
  totalPages: document.getElementById('totalPages'),
  btnBackToOptions: document.getElementById('btnBackToOptions'),
  btnNewVideo: document.getElementById('btnNewVideo'),

  // Common
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loadingText'),
  error: document.getElementById('error'),
  modal: document.getElementById('modal'),
  modalImage: document.getElementById('modalImage'),
  modalCaption: document.getElementById('modalCaption'),
  toastContainer: document.getElementById('toastContainer'),
};

// State
let currentSlide = 0;
let currentMetadata = null;
let uploadedFilePath = null;
let allFrames = [];
let currentPageNum = 1;
const FRAMES_PER_PAGE = 12;

/**
 * Navigate to a specific slide
 */
function goToSlide(slideIndex) {
  currentSlide = slideIndex;
  elements.wizardSlides.style.transform = `translateX(-${slideIndex * 100}%)`;

  // Update step indicators
  elements.steps.forEach((step, index) => {
    step.classList.remove('active', 'completed');
    if (index < slideIndex) {
      step.classList.add('completed');
    } else if (index === slideIndex) {
      step.classList.add('active');
    }
  });
}

/**
 * Show loading indicator
 */
function showLoading(text = 'Processing...') {
  elements.loadingText.textContent = text;
  elements.loading.style.display = 'flex';
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  elements.loading.style.display = 'none';
}

/**
 * Show error message
 */
function showError(message) {
  elements.error.textContent = message;
  elements.error.style.display = 'block';
  setTimeout(() => {
    elements.error.style.display = 'none';
  }, 5000);
}

/**
 * Show toast notification
 */
function showToast(title, message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = type === 'success'
    ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  elements.toastContainer.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Copy video folder name (timestamp) to clipboard for Claude
 */
async function copyPathToClipboard() {
  const path = uploadedFilePath;
  if (!path) {
    showToast('Error', 'No hay video seleccionado', 'error');
    return;
  }

  // Extract the folder name (timestamp) from the path
  // Path format: /Users/.../mcp-video/2025-11-28T11-39-09-666Z/video.mp4
  const pathParts = path.split('/');
  const folderName = pathParts[pathParts.length - 2] || path;

  try {
    await navigator.clipboard.writeText(folderName);
    showToast('Copiado al portapapeles', `"${folderName}" listo para Claude`, 'success');
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = folderName;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      showToast('Copiado al portapapeles', `"${folderName}" listo para Claude`, 'success');
    } catch (e) {
      showToast('Error', 'No se pudo copiar al portapapeles', 'error');
    }

    document.body.removeChild(textArea);
  }
}

/**
 * API call helper
 */
async function apiCall(endpoint, data) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

/**
 * Upload file to server
 */
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('video', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

/**
 * Handle file selection (from input or drop)
 */
async function handleFileSelect(file) {
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('video/')) {
    showError('Please select a video file');
    return;
  }

  showLoading('Uploading video...');

  try {
    const result = await uploadFile(file);

    if (result.success) {
      uploadedFilePath = result.filepath;
      elements.videoPath.value = result.filepath;
      currentMetadata = result.metadata;

      // Update UI to show video preview
      elements.dropZoneContent.style.display = 'none';
      elements.videoPreview.style.display = 'flex';
      elements.dropZone.classList.add('has-file');

      // Set thumbnail
      if (result.thumbnail) {
        elements.previewThumbnail.src = result.thumbnail;
      }

      // Set metadata
      const metadata = result.metadata;
      elements.previewDuration.textContent = metadata.duration;
      elements.previewFilename.textContent = result.filename;
      elements.previewResolution.textContent = metadata.resolution;
      elements.previewDurationText.textContent = metadata.duration;
      elements.previewSize.textContent = metadata.file_size;
      elements.previewCodec.textContent = metadata.codec;
      elements.previewFps.textContent = metadata.fps;
      elements.previewAudio.textContent = metadata.has_audio ? metadata.audio_codec : 'No audio';
      elements.previewPath.textContent = result.filepath;

      // Set max time inputs
      elements.endTime.max = metadata.duration_seconds;
      elements.startTime.max = metadata.duration_seconds;

      // Enable next button
      elements.btnNextToOptions.disabled = false;
    } else {
      showError(result.error?.message || 'Failed to upload file');
    }
  } catch (err) {
    showError('Upload error: ' + err.message);
  } finally {
    hideLoading();
  }
}

/**
 * Clear selected file and reset to initial state
 */
function clearFile() {
  uploadedFilePath = null;
  currentMetadata = null;
  allFrames = [];
  currentPageNum = 1;

  elements.videoPath.value = '';
  elements.fileInput.value = '';

  // Reset upload UI
  elements.dropZoneContent.style.display = 'flex';
  elements.videoPreview.style.display = 'none';
  elements.dropZone.classList.remove('has-file');
  elements.previewThumbnail.src = '';

  // Disable next button
  elements.btnNextToOptions.disabled = true;

  // Clear gallery
  elements.frameGallery.innerHTML = '';
  elements.frameCount.textContent = '';
  elements.extractionSummary.innerHTML = '';
  elements.pagination.style.display = 'none';

  // Go back to first slide
  goToSlide(0);
}

/**
 * Extract frames from video
 */
async function extractFrames() {
  const path = elements.videoPath.value.trim();
  if (!path) {
    showError('No video selected');
    return;
  }

  showLoading('Extracting frames...');

  const options = {
    path,
    interval: parseFloat(elements.interval.value) || 2,
    max_frames: parseInt(elements.maxFrames.value) || 30,
    quality: parseInt(elements.quality.value) || 75,
    width: parseInt(elements.width.value) || 800,
  };

  const startTime = parseFloat(elements.startTime.value);
  const endTime = parseFloat(elements.endTime.value);
  if (!isNaN(startTime) && startTime > 0) options.start_time = startTime;
  if (!isNaN(endTime) && endTime > 0) options.end_time = endTime;

  try {
    const result = await apiCall('/api/extract-frames', options);

    if (result.success) {
      allFrames = result.frames;
      currentPageNum = 1;

      // Update summary
      elements.frameCount.textContent = `(${result.frames.length})`;
      elements.extractionSummary.innerHTML = `
        <span>Interval: ${result.extraction_info.interval_used}s</span>
        <span>Quality: ${result.extraction_info.quality}%</span>
        <span>Width: ${result.extraction_info.width}px</span>
      `;

      // Render frames with pagination
      renderFrames();

      // Go to results slide
      goToSlide(2);
    } else {
      showError(result.error?.message || 'Failed to extract frames');
    }
  } catch (err) {
    showError('Network error: ' + err.message);
  } finally {
    hideLoading();
  }
}

/**
 * Render frames with pagination
 */
function renderFrames() {
  const totalFrames = allFrames.length;
  const totalPagesCount = Math.ceil(totalFrames / FRAMES_PER_PAGE);

  // Get frames for current page
  const startIndex = (currentPageNum - 1) * FRAMES_PER_PAGE;
  const endIndex = Math.min(startIndex + FRAMES_PER_PAGE, totalFrames);
  const pageFrames = allFrames.slice(startIndex, endIndex);

  // Render frames
  const html = pageFrames.map((frame, index) => {
    const globalIndex = startIndex + index;
    return `
      <div class="frame-card" data-index="${globalIndex}">
        <img src="data:${frame.mime_type};base64,${frame.image}" alt="Frame ${globalIndex + 1}">
        <div class="frame-info">
          <span>Frame ${globalIndex + 1}</span>
          <span>${frame.timestamp}</span>
        </div>
      </div>
    `;
  }).join('');

  elements.frameGallery.innerHTML = html;

  // Update pagination
  if (totalPagesCount > 1) {
    elements.pagination.style.display = 'flex';
    elements.currentPage.textContent = currentPageNum;
    elements.totalPages.textContent = totalPagesCount;
    elements.btnPrevPage.disabled = currentPageNum === 1;
    elements.btnNextPage.disabled = currentPageNum === totalPagesCount;
  } else {
    elements.pagination.style.display = 'none';
  }

  // Add click handlers for modal
  document.querySelectorAll('.frame-card').forEach((card) => {
    card.addEventListener('click', () => {
      const index = parseInt(card.dataset.index);
      const frame = allFrames[index];
      openModal(frame, index);
    });
  });
}

/**
 * Go to previous page
 */
function prevPage() {
  if (currentPageNum > 1) {
    currentPageNum--;
    renderFrames();
  }
}

/**
 * Go to next page
 */
function nextPage() {
  const totalPagesCount = Math.ceil(allFrames.length / FRAMES_PER_PAGE);
  if (currentPageNum < totalPagesCount) {
    currentPageNum++;
    renderFrames();
  }
}

/**
 * Open modal with full-size image
 */
function openModal(frame, index) {
  elements.modalImage.src = `data:${frame.mime_type};base64,${frame.image}`;
  elements.modalCaption.textContent = `Frame ${index + 1} - ${frame.timestamp}`;
  elements.modal.style.display = 'flex';
}

/**
 * Close modal
 */
function closeModal() {
  elements.modal.style.display = 'none';
}

/**
 * Setup drag and drop handlers
 */
function setupDragAndDrop() {
  const dropZone = elements.dropZone;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      if (!dropZone.classList.contains('has-file')) {
        dropZone.classList.add('drag-over');
      }
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (!dropZone.classList.contains('has-file')) {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    }
  });

  elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  dropZone.addEventListener('click', (e) => {
    if (!dropZone.classList.contains('has-file') &&
        e.target !== elements.fileInput &&
        !e.target.closest('label')) {
      elements.fileInput.click();
    }
  });
}

/**
 * Initialize event listeners
 */
function init() {
  // Setup drag and drop
  setupDragAndDrop();

  // Slide 1 buttons
  elements.btnClearFile.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  elements.btnNextToOptions.addEventListener('click', () => {
    goToSlide(1);
  });

  // Slide 2 buttons
  elements.btnBackToUpload.addEventListener('click', () => {
    goToSlide(0);
  });

  elements.btnExtract.addEventListener('click', extractFrames);

  // Slide 3 buttons
  elements.btnBackToOptions.addEventListener('click', () => {
    goToSlide(1);
  });

  elements.btnCopyPath.addEventListener('click', copyPathToClipboard);

  elements.btnNewVideo.addEventListener('click', clearFile);

  // Pagination
  elements.btnPrevPage.addEventListener('click', prevPage);
  elements.btnNextPage.addEventListener('click', nextPage);

  // Modal
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();

    // Arrow keys for pagination when on results slide
    if (currentSlide === 2 && elements.modal.style.display === 'none') {
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'ArrowRight') nextPage();
    }
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
