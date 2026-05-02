// ========================================
// Screen 3: Processing Component
// Shows CV submission progress
// ========================================

const Screen3Component = {
    animationTimer: null,

    async init() {
        if (Config.DEBUG) console.log('[Screen3] Initializing...');
        this.renderSteps();
        this.startAnimation();
    },

    renderSteps() {
        const container = document.querySelector('#screen3 .processing-steps');
        if (!container) return;

        container.innerHTML = ProcessingSteps.map((step, index) => `
            <div class="processing-step" id="step${index + 1}" data-status="${step.status}">
                <div class="step-indicator">${this.getStepIcon(step.status)}</div>
                <span class="step-text">${Helpers.escapeHtml(step.text)}</span>
            </div>
        `).join('');
    },

    getStepIcon(status) {
        switch (status) {
            case 'completed': return '✓';
            case 'active': return '→';
            case 'pending': return '○';
            default: return '○';
        }
    },

    startAnimation() {
        const stepElements = document.querySelectorAll('#screen3 .processing-step');
        const duration = Config.UI.ANIMATION.PROCESSING_STEP;

        stepElements.forEach(el => {
            el.classList.remove('completed', 'active');
            el.querySelector('.step-indicator').textContent = '○';
        });

        stepElements.forEach((stepEl, index) => {
            setTimeout(() => {
                for (let i = 0; i < index; i++) {
                    stepElements[i].classList.remove('active');
                    stepElements[i].classList.add('completed');
                    stepElements[i].querySelector('.step-indicator').textContent = '✓';
                }

                stepEl.classList.add('active');
                stepEl.querySelector('.step-indicator').textContent = '→';

                if (index === stepElements.length - 1) {
                    this.animationTimer = setTimeout(() => {
                        stepEl.classList.remove('active');
                        stepEl.classList.add('completed');
                        stepEl.querySelector('.step-indicator').textContent = '✓';

                        AppState.cvSubmitted = true;
                        AppState.submittedAt = new Date().toISOString();
                    }, duration);
                }
            }, index * duration);
        });
    },

    stopAnimation() {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
    },

    /**
     * Handle HR simulation - phan tich CV roi chuyen sang Screen 4
     */
    async simulateHRResponse() {
        if (!Config.FEATURES.DEMO_HR_SIMULATION) return;

        const btn = document.querySelector('#screen3 .btn-primary');
        if (btn) Helpers.setButtonLoading(btn, 'Đang phân tích...');

        try {
            AppState.analysisResult = null;
            const analysisResult = await CVAnalysisService.scoreFromEditedForm();
            AppState.analysisResult = analysisResult;
            AppState.analysisId = 'XGB-' + Date.now();

            if (Config.DEBUG) console.log('[Screen3] Analysis:', AppState.analysisResult);

            if (typeof HrPoolService !== 'undefined') {
                var formSnap = typeof Screen2Component !== 'undefined' && Screen2Component.getFormData
                    ? Screen2Component.getFormData()
                    : null;
                var aiLines = (typeof Screen4Component !== 'undefined' && Screen4Component.buildAiLinesFromAnalysis)
                    ? Screen4Component.buildAiLinesFromAnalysis(analysisResult)
                    : { strengthLines: [], developmentLines: [] };
                HrPoolService.submitCandidate(analysisResult, formSnap, aiLines);
            }

        } catch (err) {
            console.error('[Screen3] scoreFromEditedForm failed:', err);
            Helpers.showToast(err.message || 'Không chấm điểm được — kiểm tra server.py (cổng 5001)', 'error');
            if (btn) Helpers.resetButton(btn);
            return;
        }

        if (btn) Helpers.resetButton(btn);
        App.goToScreen(4);
    },

    cleanup() {
        this.stopAnimation();
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Screen3Component;
}
