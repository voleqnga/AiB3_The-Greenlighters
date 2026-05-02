// ========================================
// Screen 1: AI Transparency Component
// Handles consent and PDF upload UI
// ========================================

const Screen1Component = {
    uploadedFile: null,

    /**
     * Initialize Screen 1
     */
    async init() {
        if (Config.DEBUG) console.log('[Screen1] Initializing...');

        // Setup consent checkbox
        this.setupConsent();

        // Setup PDF upload
        this.setupPDFUpload();
    },

    /**
     * Setup consent checkbox functionality
     */
    setupConsent() {
        const checkbox = document.getElementById('consentCheckbox');

        if (checkbox) {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    AppState.consentGiven = true;
                    AppState.consentTime = new Date().toISOString();
                } else {
                    AppState.consentGiven = false;
                }
                // Update button state based on both conditions
                this.updateContinueButton();
            });
        }
    },

    /**
     * Update continue button state based on requirements
     * Requires both: consent checkbox AND PDF uploaded
     */
    updateContinueButton() {
        const continueBtn = document.getElementById('continueBtn1');
        const checkbox = document.getElementById('consentCheckbox');

        if (continueBtn) {
            const canProceed = checkbox?.checked && this.uploadedFile !== null;
            continueBtn.disabled = !canProceed;

            if (Config.DEBUG) {
                console.log('[Screen1] Can proceed:', canProceed,
                    '| Consent:', checkbox?.checked,
                    '| File:', this.uploadedFile?.name);
            }
        }
    },

    /**
     * Check if user can proceed
     * @returns {boolean} Can proceed to next screen
     */
    canProceed() {
        const checkbox = document.getElementById('consentCheckbox');
        return checkbox?.checked && this.uploadedFile !== null;
    },

    /**
     * Setup PDF upload functionality
     */
    setupPDFUpload() {
        const dropzone = document.getElementById('uploadDropzone');
        const fileInput = document.getElementById('cvFileInput');
        const removeBtn = document.getElementById('removeFile');

        if (!dropzone || !fileInput) return;

        // Click to upload
        dropzone.addEventListener('click', (e) => {
            // Ignore if clicked on INPUT or the Label Button (native behavior handles these)
            if (e.target.tagName !== 'INPUT' && !e.target.closest('.upload-btn')) {
                fileInput.click();
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Drag and drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');

            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        // Remove file button
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeUploadedFile();
            });
        }
    },

    /**
     * Handle file upload
     * @param {File} file - The uploaded file
     */
    async handleFileUpload(file) {
        const uploadSection = document.querySelector('.upload-section');
        const dropzone = document.getElementById('uploadDropzone');
        const processingOverlay = document.getElementById('uploadProcessing');

        try {
            // Show processing state
            if (uploadSection) uploadSection.classList.add('processing');
            if (dropzone) dropzone.style.display = 'none';
            if (processingOverlay) processingOverlay.style.display = 'flex';

            // Validate file using PDFService
            const result = await PDFService.processCV(file);

            await new Promise(resolve => setTimeout(resolve, 400));

            if (Config.DEBUG) console.log('[Screen1] File uploaded:', result);

            // Store file reference + extracted data for Screen 2 (no mock / no separate upload API)
            this.uploadedFile = file;
            AppState.uploadedFile = file;
            AppState.rawCVText = result.rawText;
            AppState.cvTokens = result.tokens;
            try {
                AppState.parsedCVData = JSON.parse(JSON.stringify(result.parsedCVData));
            } catch (e) {
                AppState.parsedCVData = result.parsedCVData;
            }
            AppState.fileInfo = result.fileInfo;
            AppState.currentCVId = result.cvId || null;

            // Hide processing, show success
            if (uploadSection) uploadSection.classList.remove('processing');
            if (processingOverlay) processingOverlay.style.display = 'none';

            // Update UI
            this.showUploadSuccess(file);

            // Auto-check consent with explicit logging
            const checkbox = document.getElementById('consentCheckbox');
            if (checkbox) {
                console.log('[Screen1] Auto-checking consent for:', file.name);
                checkbox.checked = true;
                // Dispatch change event to trigger listeners
                checkbox.dispatchEvent(new Event('change'));
            } else {
                console.error('[Screen1] Consent checkbox not found!');
            }

            // Update continue button state
            this.updateContinueButton();

            if (result.saveToServer?.ok) {
                Helpers.showToast(
                    `Đã trích xuất và lưu JSON: ${result.saveToServer.filename || result.jsonFileName}`,
                    'success'
                );
            } else {
                Helpers.showToast(
                    'CV đã trích xuất. Chưa lưu được file lên server — chạy: python3 server.py (port 5001).',
                    'warning'
                );
            }

        } catch (error) {
            console.error('[Screen1] File upload error:', error);

            // Hide processing, show dropzone again
            if (uploadSection) uploadSection.classList.remove('processing');
            if (processingOverlay) processingOverlay.style.display = 'none';
            if (dropzone) dropzone.style.display = 'block';

            Helpers.showToast(error.message || 'Lỗi khi xử lý file', 'error');
        }
    },

    /**
     * Show upload success UI
     * @param {File} file - The uploaded file
     */
    showUploadSuccess(file) {
        const dropzone = document.getElementById('uploadDropzone');
        const uploadPreview = document.getElementById('uploadPreview');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');

        if (dropzone) {
            dropzone.style.display = 'none';
        }

        if (uploadPreview) {
            uploadPreview.style.display = 'block';
        }

        if (fileName) {
            fileName.textContent = file.name;
        }

        if (fileSize) {
            fileSize.textContent = `(${Helpers.formatFileSize(file.size)})`;
        }
    },

    /**
     * Remove uploaded file
     */
    removeUploadedFile() {
        const dropzone = document.getElementById('uploadDropzone');
        const uploadPreview = document.getElementById('uploadPreview');
        const fileInput = document.getElementById('cvFileInput');

        this.uploadedFile = null;
        AppState.uploadedFile = null;
        AppState.rawCVText = null;
        AppState.cvTokens = [];
        AppState.parsedCVData = null;
        AppState.fileInfo = null;
        AppState.currentCVId = null;
        AppState.confirmedCVData = null;

        if (dropzone) {
            dropzone.style.display = 'block';
        }

        if (uploadPreview) {
            uploadPreview.style.display = 'none';
        }

        if (fileInput) {
            fileInput.value = '';
        }

        // Update continue button state
        this.updateContinueButton();

        Helpers.showToast('Đã xóa file', 'info');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Screen1Component;
}
