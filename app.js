// ========================================
// Main Application Controller
// Orchestrates all components and manages state
// ========================================

// ========================================
// GLOBAL APPLICATION STATE
// ========================================
const AppState = {
    // Current screen — can be '0', 'HR', or 1–5
    currentScreen: '0',

    // User consent
    consentGiven: false,
    consentTime: null,

    // Uploaded file
    uploadedFile: null,

    // CV data - duoc dien boi PDFService + CVAnalysisService
    currentCVId: null,
    rawCVText: null,
    cvTokens: [],
    parsedCVData: null,
    confirmedCVData: null,
    fileInfo: null,
    cvModified: false,

    // Analysis result - duoc dien boi Screen3 truoc khi chuyen sang Screen4
    analysisId: null,
    analysisResult: null,

    // JD data (HR flow) — server chỉ lưu một JD (JD_current.json)
    jdData: null,
    jdRawText: null,

    // Submission
    cvSubmitted: false,
    submittedAt: null,

    // Survey
    surveySubmitted: false,

    /** Ứng viên: đang xem tab Thông báo kết quả thay vì màn 1–5 */
    candidateNoticeView: false
};

// Make state accessible globally for debugging
window.AppState = AppState;

// ========================================
// MAIN APPLICATION OBJECT
// ========================================
const App = {
    // Component references
    components: {
        screen0: Screen0Component,
        screen1: Screen1Component,
        screen2: Screen2Component,
        screen3: Screen3Component,
        screen4: Screen4Component,
        screen5: Screen5Component,
        screenHR: ScreenHRComponent
    },

    _screenElementId(id) {
        if (id === '0') return 'screen0';
        if (id === 'HR') return 'screenHR';
        return `screen${id}`;
    },

    /**
     * Initialize the application
     */
    async init() {
        if (Config.DEBUG) {
            console.log('========================================');
            console.log('AI Recruitment Demo - Initializing...');
            console.log('========================================');
        }

        await this._resetHrPoolOnPageLoad();

        // Setup landing screen (Screen 0) buttons
        this.setupLanding();

        // Setup navigation
        this.setupNavigation();

        // Setup global event handlers
        this.setupEventHandlers();

        // Progress bar is hidden on screen 0/HR
        this.updateProgressBar();

        this.setupCandidateNoticeTabs();

        if (Config.DEBUG) {
            console.log('App initialized successfully!');
        }
    },

    /**
     * Mỗi lần load/reload trang: xóa pool ứng viên trên server + id ứng viên trong sessionStorage.
     * Trong cùng phiên (không reload), không gọi lại — mọi CV chấm xong vẫn tích lũy trong list HR.
     */
    async _resetHrPoolOnPageLoad() {
        if (typeof Config === 'undefined' || !Config.getApiUrl) return;
        const poolUrl = Config.getApiUrl('/hr/pool');
        const clearUrl = Config.getApiUrl('/hr/pool/clear');
        try {
            // GET ?clear=1: ít vướng CORS preflight hơn POST; một request vừa xóa vừa trả pool rỗng
            let res = await fetch(poolUrl + '?clear=1&_=' + Date.now(), {
                method: 'GET',
                cache: 'no-store',
                credentials: 'omit'
            });
            if (!res.ok) {
                res = await fetch(clearUrl, { method: 'GET', cache: 'no-store', credentials: 'omit' });
            }
            if (!res.ok) {
                res = await fetch(clearUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}',
                    credentials: 'omit'
                });
            }
            if (!res.ok && Config.DEBUG) {
                console.warn('[App] Không làm sạch được pool HR — cần server chạy (cổng 5001) và mở trang qua http://localhost hoặc http://127.0.0.1 (tránh file://).');
            }
        } catch (e) {
            if (Config.DEBUG) console.warn('[App] HR pool clear:', e);
        }
        try {
            sessionStorage.removeItem('hr_candidate_id');
        } catch (e) { /* ignore */ }
    },

    _exitCandidateNoticeView() {
        AppState.candidateNoticeView = false;
        document.getElementById('screenCandidateNotice')?.classList.remove('active');
        const tf = document.getElementById('candidateTabFlow');
        const tn = document.getElementById('candidateTabNotice');
        tf?.classList.add('active');
        tn?.classList.remove('active');
    },

    _showCandidateFlowTab() {
        this._exitCandidateNoticeView();
        const cur = AppState.currentScreen;
        if (typeof cur === 'number' && cur >= 1 && cur <= 5) {
            document.getElementById(`screen${cur}`)?.classList.add('active');
        }
    },

    async _showCandidateNoticeTab() {
        AppState.candidateNoticeView = true;
        for (let n = 1; n <= 5; n++) {
            document.getElementById(`screen${n}`)?.classList.remove('active');
        }
        document.getElementById('screenCandidateNotice')?.classList.add('active');
        document.getElementById('candidateTabFlow')?.classList.remove('active');
        document.getElementById('candidateTabNotice')?.classList.add('active');
        await this._refreshCandidateNoticeContent();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async _refreshCandidateNoticeContent() {
        const body = document.getElementById('candidateNoticeBody');
        if (!body) return;

        const esc = typeof Helpers !== 'undefined' && Helpers.escapeHtml
            ? Helpers.escapeHtml.bind(Helpers)
            : function (t) {
                const d = document.createElement('div');
                d.textContent = t == null ? '' : String(t);
                return d.innerHTML;
            };

        const cid = sessionStorage.getItem('hr_candidate_id');
        if (!cid) {
            body.innerHTML = '<p style="margin:0;line-height:1.6;color:#555;">Bạn chưa có hồ sơ được hệ thống ghi nhận. Hãy hoàn tất các bước nộp CV và <strong>Phân tích AI &amp; xem kết quả</strong> — sau đó có thể xem phản hồi HR tại đây.</p>';
            return;
        }

        body.innerHTML = '<p style="margin:0;color:#666;">Đang tải…</p>';

        let c = null;
        if (typeof HrPoolService !== 'undefined' && HrPoolService.fetchCandidateById) {
            c = await HrPoolService.fetchCandidateById(cid);
        }

        if (!c) {
            body.innerHTML = ''
                + '<p style="margin:0;line-height:1.65;color:#555;">Chúng tôi chưa tải được thông tin hồ sơ của bạn lúc này — có thể do kết nối mạng hoặc hệ thống đang cập nhật. Đừng lo, bạn hãy thử bấm <strong>Làm mới</strong> sau vài giây nhé.</p>'
                + '<p style="margin:0.85rem 0 0;line-height:1.65;color:#666;font-size:0.95rem;">Nếu bạn mới bắt đầu, hãy hoàn tất các bước trong <strong>Quy trình ứng tuyển</strong> (nộp CV và xem kết quả phân tích AI) trước — sau đó quay lại đây để xem phản hồi từ nhà tuyển dụng.</p>';
            return;
        }

        if (!c.hrDecision) {
            body.innerHTML = '<p style="margin:0;line-height:1.6;color:#555;">HR <strong>chưa gửi quyết định</strong> cho hồ sơ của bạn. Vui lòng quay lại sau.</p>'
                + (c.score != null ? `<p style="margin:0.75rem 0 0;color:#666;">Điểm AI hiện tại: <strong>${esc(String(c.score))}</strong></p>` : '');
            return;
        }

        const pass = c.hrDecision === 'pass';
        const fb = (c.hrFeedback || '').trim();
        const when = c.decidedAt || c.notifiedAt || '';

        body.innerHTML = `
            <div class="candidate-notice-card ${pass ? 'candidate-notice-card--pass' : 'candidate-notice-card--fail'}">
                <p class="candidate-notice-badge">${pass ? 'ĐẬU' : 'RỚT'}</p>
                <p class="candidate-notice-title">${pass ? 'Chúc mừng — hồ sơ của bạn được đánh giá tích cực' : 'Hồ sơ chưa phù hợp ở thời điểm này'}</p>
                ${fb ? `<div class="candidate-notice-feedback"><strong>Nhận xét từ HR:</strong><br>${esc(fb).replace(/\n/g, '<br>')}</div>` : ''}
                ${when ? `<p class="candidate-notice-meta">Cập nhật: ${esc(when)}</p>` : ''}
            </div>`;
    },

    setupCandidateNoticeTabs() {
        document.getElementById('candidateTabFlow')?.addEventListener('click', () => {
            this._showCandidateFlowTab();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.getElementById('candidateTabNotice')?.addEventListener('click', () => {
            this._showCandidateNoticeTab();
        });
        document.getElementById('candidateNoticeRefresh')?.addEventListener('click', () => {
            if (AppState.candidateNoticeView) this._refreshCandidateNoticeContent();
        });
    },

    /**
     * Ứng viên: tải JD hiện tại từ server (một JD duy nhất).
     */
    async _loadJdForCandidateSession() {
        if (AppState.jdData) return;
        try {
            const url = Config.getApiUrl('/jd/load');
            const res = await fetch(url);
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success && data.jd_data) {
                AppState.jdData = data.jd_data;
                AppState.jdRawText = data.rawText || '';
                if (Config.DEBUG) console.log('[App] Đã tải JD hiện tại từ server');
            }
        } catch (e) {
            console.warn('[App] Không tải được JD:', e);
        }
    },

    setupLanding() {
        document.getElementById('btnRoleHR')?.addEventListener('click', () => {
            this.goToScreen('HR');
        });
        document.getElementById('btnRoleCandidate')?.addEventListener('click', async () => {
            await this.goToScreen(1);
        });
        document.getElementById('btnHRBack')?.addEventListener('click', () => {
            this.goToScreen('0');
        });
        document.getElementById('btnScreen1Back')?.addEventListener('click', () => {
            this.goToScreen('0');
        });
    },

    /**
     * Navigate to a specific screen
     * @param {number} screenNumber - Screen number (1-5)
     */
    async goToScreen(screenId) {
        const validIds = ['0', 'HR', 1, 2, 3, 4, 5];
        if (!validIds.includes(screenId)) return;

        if (AppState.candidateNoticeView) {
            this._exitCandidateNoticeView();
        }

        // Cleanup current screen
        const curKey = AppState.currentScreen === 'HR' ? 'screenHR' : `screen${AppState.currentScreen}`;
        const currentComponent = this.components[curKey];
        if (currentComponent?.cleanup) {
            currentComponent.cleanup();
        }

        // Hide current screen
        const curEl = document.getElementById(this._screenElementId(AppState.currentScreen));
        if (curEl) curEl.classList.remove('active');

        // Show new screen
        const newEl = document.getElementById(this._screenElementId(screenId));
        if (newEl) newEl.classList.add('active');

        // Update state
        AppState.currentScreen = screenId;

        // Toggle progress bar visibility
        this.updateProgressBar();

        // Initialize new screen's component
        const newKey = screenId === 'HR' ? 'screenHR' : `screen${screenId}`;
        const newComponent = this.components[newKey];
        if (newComponent?.init) {
            await newComponent.init();
        }

        if (screenId === 1) {
            await this._loadJdForCandidateSession();
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (Config.DEBUG) {
            console.log(`[App] Navigated to Screen ${screenId}`);
        }
    },

    /**
     * Update progress bar dots
     */
    updateProgressBar() {
        const bar = document.getElementById('progressBar');
        const candTabs = document.getElementById('candidateMainTabs');
        const isNumbered = typeof AppState.currentScreen === 'number';
        if (bar) bar.style.display = isNumbered ? '' : 'none';
        if (candTabs) candTabs.style.display = isNumbered ? '' : 'none';

        if (isNumbered) {
            const dots = document.querySelectorAll('.progress-dot');
            dots.forEach((dot, index) => {
                const screenNum = index + 1;
                dot.classList.remove('active', 'completed');
                if (screenNum === AppState.currentScreen) {
                    dot.classList.add('active');
                } else if (screenNum < AppState.currentScreen) {
                    dot.classList.add('completed');
                }
            });
        }
    },

    /**
     * Setup navigation button handlers
     */
    setupNavigation() {
        // Screen 1 -> Screen 2
        const continueBtn1 = document.getElementById('continueBtn1');
        if (continueBtn1) {
            continueBtn1.addEventListener('click', async () => {
                if (this.components.screen1.canProceed()) {
                    await this.goToScreen(2);
                }
            });
        }

        // Progress dots click navigation (optional)
        document.querySelectorAll('.progress-dot').forEach(dot => {
            dot.addEventListener('click', async (e) => {
                const screenNum = parseInt(dot.dataset.screen);
                // Only allow going back, not forward
                if (screenNum < AppState.currentScreen) {
                    await this.goToScreen(screenNum);
                }
            });
        });

        /* Nút GỬI CV màn 2: gắn trong Screen2 (delegation) để luôn gọi được submitCVGoToScreen3 */
    },

    /**
     * Setup global event handlers
     */
    setupEventHandlers() {
        // Consent checkbox
        const consentCheckbox = document.getElementById('consentCheckbox');
        const checkboxWrapper = document.querySelector('.checkbox-wrapper');

        if (checkboxWrapper && consentCheckbox) {
            // Remove click listener - rely on native label behavior and Screen1 handler
            // checkboxWrapper.addEventListener('click', ...) 
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('successModal');
                if (modal?.classList.contains('active')) {
                    modal.classList.remove('active');
                }
            }
        });
    },

    /**
     * Reset the entire demo
     */
    /**
     * Reset the entire demo
     */
    async reset() {
        // Hide modal
        document.getElementById('successModal')?.classList.remove('active');

        // Reset state (DO NOT reset currentScreen here, let goToScreen handle it)
        Object.assign(AppState, {
            consentGiven: false,
            consentTime: null,
            uploadedFile: null,
            cvModified: false,
            cvSubmitted: false,
            submittedAt: null,
            surveySubmitted: false,
            analysisResult: null,
            analysisId: null,
            parsedCVData: null,
            rawCVText: null,
            confirmedCVData: null,
            candidateNoticeView: false
        });

        // Reset UI elements
        const consentCheckbox = document.getElementById('consentCheckbox');
        if (consentCheckbox) consentCheckbox.checked = false;

        const continueBtn1 = document.getElementById('continueBtn1');
        if (continueBtn1) continueBtn1.disabled = true;

        // Reset upload UI
        const dropzone = document.getElementById('uploadDropzone');
        const uploadPreview = document.getElementById('uploadPreview');
        const uploadProcessing = document.getElementById('uploadProcessing');
        const uploadSection = document.querySelector('.upload-section');
        if (dropzone) dropzone.style.display = 'block';
        if (uploadPreview) uploadPreview.style.display = 'none';
        if (uploadProcessing) uploadProcessing.style.display = 'none';
        if (uploadSection) uploadSection.classList.remove('processing');

        // Reset survey
        this.components.screen5.reset();

        // Remove active class from ALL screens to be safe
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        document.getElementById('candidateTabFlow')?.classList.add('active');
        document.getElementById('candidateTabNotice')?.classList.remove('active');

        // Go back to landing (Screen 0)
        await this.goToScreen('0');

        if (Config.DEBUG) {
            console.log('[App] Demo reset complete');
        }
    }
};

// ========================================
// GLOBAL FUNCTIONS FOR HTML ONCLICK
// ========================================

function goToScreen(screenNumber) {
    App.goToScreen(screenNumber);
}

/**
 * Screen 2 → Screen 3: lưu form (gồm 4 nhóm kỹ năng), chưa gọi XGBoost.
 * Chấm điểm thực hiện ở Screen 3 (nút "Phân tích AI & xem kết quả").
 */
async function submitCVGoToScreen3() {
    console.log('[App] submitCVGoToScreen3 called');
    if (!AppState.jdData || !AppState.jdData.jobTitle) {
        Helpers.showToast('Vui lòng quay lại trang chủ và upload JD trước khi phân tích.', 'error');
        return;
    }
    try {
        Screen2Component.syncParsedDataFromForm();
        AppState.confirmedCVData = Screen2Component.getFormData();
        AppState.cvSubmitted = true;
        AppState.submittedAt = new Date().toISOString();
        console.log('[App] Going to screen 3...');
        await App.goToScreen(3);
    } catch (err) {
        console.error('[App] submitCVGoToScreen3 error:', err);
        Helpers.showToast(err.message || 'Không chuyển được màn hình', 'error');
    }
}

function toggleCheckbox() {
    const checkbox = document.getElementById('consentCheckbox');
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change'));
}

function simulateHRResponse() {
    Screen3Component.simulateHRResponse();
}

function completeSurvey() {
    Screen5Component.submit();
}

function endSession() {
    // Hide modal
    document.getElementById('successModal')?.classList.remove('active');

    // Reset and go back to Screen 1
    App.reset();
}


// Gắn lên window để onclick trong HTML (goToScreen, …) luôn resolve được — kể cả preview/iframe.
if (typeof window !== 'undefined') {
    window.goToScreen = goToScreen;
    window.submitCVGoToScreen3 = submitCVGoToScreen3;
    window.simulateHRResponse = simulateHRResponse;
    window.completeSurvey = completeSurvey;
    window.endSession = endSession;
    window.toggleCheckbox = toggleCheckbox;
}

// ========================================
// INITIALIZE APP ON DOM READY
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
