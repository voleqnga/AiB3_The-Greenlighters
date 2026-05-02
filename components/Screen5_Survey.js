// ========================================
// Screen 5: Survey Component
// AI Ethics & Experience Survey
// ========================================

const Screen5Component = {
    ratings: {},
    comments: {},

    /**
     * Initialize Screen 5
     */
    async init() {
        if (Config.DEBUG) console.log('[Screen5] Initializing...');

        // Render survey items (from fixed UI content)
        this.renderSurveyItems();

        // Setup star rating interactions
        this.setupStarRatings();

        // Setup comment listeners
        this.setupCommentListeners();
    },

    /**
     * Render survey question items
     */
    renderSurveyItems() {
        const container = document.querySelector('#screen5 .survey-container');
        if (!container) return;

        // Find footer to insert before
        const footer = container.querySelector('.footer-actions');

        // Remove existing survey items
        container.querySelectorAll('.survey-item').forEach(el => el.remove());

        // Add survey items from mockData
        const itemsHtml = SurveyQuestions.map((q, index) => {
            if (q.type === 'text') {
                // Text-only question (like "Additional Feedback")
                return `
                    <div class="survey-item text-only" data-question-id="${q.id}">
                        <div class="survey-item-header">
                            <h4>${index + 1}. ${Helpers.escapeHtml(q.text)}</h4>
                        </div>
                        <div class="comment-box visible" data-question="${q.id}">
                            <textarea class="input-field textarea-field" placeholder="Chia sẻ thêm (tùy chọn)..." style="min-height: 100px; resize: vertical;"></textarea>
                        </div>
                    </div>
                `;
            } else {
                // Rating question (Standard)
                return `
                    <div class="survey-item" data-question-id="${q.id}">
                        <div class="survey-item-header">
                            <h4>${index + 1}. ${Helpers.escapeHtml(q.text)}</h4>
                            <div class="star-rating" data-question="${q.id}">
                                <span class="star" data-value="1">☆</span>
                                <span class="star" data-value="2">☆</span>
                                <span class="star" data-value="3">☆</span>
                                <span class="star" data-value="4">☆</span>
                                <span class="star" data-value="5">☆</span>
                            </div>
                        </div>
                        <div class="comment-box visible" data-question="${q.id}">
                            <input type="text" class="input-field" placeholder="Nhận xét (bắt buộc)...">
                        </div>
                    </div>
                `;
            }
        }).join('');

        // Insert before footer
        if (footer) {
            footer.insertAdjacentHTML('beforebegin', itemsHtml);
        } else {
            container.insertAdjacentHTML('beforeend', itemsHtml);
        }
    },

    /**
     * Setup star rating interactions
     */
    setupStarRatings() {
        document.querySelectorAll('#screen5 .star-rating').forEach(ratingContainer => {
            ratingContainer.querySelectorAll('.star').forEach(star => {
                star.onclick = (e) => {
                    const questionId = ratingContainer.dataset.question;
                    const value = parseInt(e.target.dataset.value);
                    this.ratings[questionId] = value;
                    this.updateStarDisplay(ratingContainer, value);
                };
            });
        });
    },

    /**
     * Update star display for a given rating container
     * @param {HTMLElement} ratingContainer
     * @param {number} value
     */
    updateStarDisplay(ratingContainer, value) {
        ratingContainer.querySelectorAll('.star').forEach(star => {
            const starValue = parseInt(star.dataset.value);
            if (starValue <= value) {
                star.classList.add('active');
                star.textContent = '★';
                star.style.color = '#FFD700'; // Gold color
            } else {
                star.classList.remove('active');
                star.textContent = '☆';
                star.style.color = '';
            }
        });
    },

    /**
     * Setup comment toggles
     */
    setupCommentToggles() {
        document.querySelectorAll('#screen5 .comment-toggle').forEach(toggle => {
            toggle.onclick = (e) => {
                const questionId = toggle.dataset.question;
                const commentBox = document.querySelector(`.comment-box[data-question="${questionId}"]`);
                if (commentBox) {
                    commentBox.classList.toggle('visible');
                    if (commentBox.classList.contains('visible')) {
                        toggle.innerHTML = '<span>💬</span> Ẩn nhận xét';
                    } else {
                        toggle.innerHTML = '<span>💬</span> Thêm nhận xét';
                    }
                }
            };
        });
    },

    /**
     * Setup comment input listeners
     */
    setupCommentListeners() {
        // Track comment changes immediately (Input and Textarea)
        const commentInputs = document.querySelectorAll('#screen5 .comment-box input, #screen5 .comment-box textarea');

        commentInputs.forEach(input => {
            // Use 'input' event for real-time tracking
            input.oninput = (e) => {
                const questionId = input.closest('.comment-box').dataset.question;
                if (input.value.trim()) {
                    this.comments[questionId] = input.value.trim();
                } else {
                    delete this.comments[questionId];
                }
            };
        });
    },

    /**
     * Get all survey responses
     * @returns {Object} Survey response data
     */
    getResponses() {
        return {
            ratings: { ...this.ratings },
            comments: { ...this.comments },
            submittedAt: new Date().toISOString()
        };
    },

    /**
     * Validate survey before submission
     * @returns {Object} Validation result
     */
    validate() {
        const totalQuestions = SurveyQuestions.length;
        const missingQuestions = [];

        // Identify missing questions
        SurveyQuestions.forEach(q => {
            // Skip check if optional
            if (!q.required) return;

            const isRatingType = (q.type === 'rating');

            // Check Rating (only for rating type)
            const hasRating = isRatingType ? !!this.ratings[q.id] : true;

            // Check Comment (for all required types)
            const hasComment = !!this.comments[q.id];

            if (!hasRating || !hasComment) {
                missingQuestions.push(q.id);
            }
        });

        if (missingQuestions.length > 0) {
            // Highlight missing questions
            missingQuestions.forEach(id => {
                const item = document.querySelector(`.survey-item[data-question-id="${id}"]`);
                if (item) {
                    item.classList.add('error-highlight');
                    // Highlight input specific
                    const input = item.querySelector('input, textarea');
                    if (input && !this.comments[id]) input.classList.add('error-border');
                }
            });

            const firstMissing = document.querySelector(`.survey-item[data-question-id="${missingQuestions[0]}"]`);
            if (firstMissing) firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });

            return {
                isValid: false,
                errors: [`Vui lòng điền đầy đủ thông tin bắt buộc.`]
            };
        }

        return { isValid: true, errors: [] };
    },

    /**
     * Prepare data as a flat row for Google Sheets
     * @returns {Object} Flat object matching sheet columns
     */
    prepareSheetData() {
        const responses = this.getResponses();
        const sheetRow = {
            Timestamp: responses.submittedAt,
            CV_ID: AppState.currentCVId || 'N/A',
            Candidate_Name: AppState.confirmedCVData?.basicInfo?.name || 'Anonymous',
            Overall_Match_Score: AppState.analysisResult?.matchScore || 0,

            // Dynamic Questions (Q1..Q8)
            ...SurveyQuestions.reduce((acc, q, idx) => {
                acc[`Q${idx + 1}_Rating`] = responses.ratings[q.id] || '';
                acc[`Q${idx + 1}_Comment`] = responses.comments[q.id] || '';
                return acc;
            }, {}),

            // Additional Feedback (Map Q8 if it exists, otherwise empty)
            Additional_Feedback: responses.comments[8] || ''
        };
        return sheetRow;
    },

    /**
     * Submit survey to backend
     * @returns {Promise<Object>} Submission result
     */
    async submit() {
        // Prevent multiple submissions
        if (this.isSubmitting) return;

        // Clear previous errors
        document.querySelectorAll('.survey-item.error-highlight').forEach(el => el.classList.remove('error-highlight'));
        document.querySelectorAll('.error-border').forEach(el => el.classList.remove('error-border'));

        const validation = this.validate();

        if (!validation.isValid) {
            Helpers.showToast(validation.errors[0], 'error');
            return { success: false, errors: validation.errors };
        }

        try {
            this.isSubmitting = true;

            // Disable button
            const btn = document.querySelector('#screen5 .btn-primary');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = 'Đang gửi... <div class="processing-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-left:8px;"></div>';
            }

            const sheetData = this.prepareSheetData();
            const result = await Database.submitSurvey(sheetData);

            this.showSuccessModal();
            this.isSubmitting = false;

            return { success: true, data: result };
        } catch (error) {
            console.error('[Screen5] Error submitting survey:', error);
            Helpers.showToast('Không thể gửi khảo sát. Vui lòng thử lại.', 'error');
            this.isSubmitting = false;

            const btn = document.querySelector('#screen5 .btn-primary');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'HOÀN TẤT <span>✓</span>';
            }

            return { success: false, error };
        }
    },

    /**
     * Show success modal after submission
     */
    showSuccessModal() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.classList.add('active');
        }
    },

    /**
     * Reset survey form
     */
    reset() {
        this.ratings = {};
        this.comments = {};
        this.isSubmitting = false;

        // Reset star displays
        document.querySelectorAll('#screen5 .star').forEach(star => {
            star.classList.remove('active');
            star.textContent = '☆';
            star.style.color = '';
        });

        // Reset comment boxes
        document.querySelectorAll('#screen5 .comment-box input, #screen5 .comment-box textarea').forEach(input => {
            input.value = '';
            input.classList.remove('error-border');
        });

        document.querySelectorAll('#screen5 .comment-toggle').forEach(toggle => {
            toggle.innerHTML = '<span>💬</span> Thêm nhận xét';
        });
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Screen5Component;
}
