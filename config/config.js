// ========================================
// Configuration - AI Recruitment Demo
// ========================================

const Config = {
    // ========================================
    // MODE SETTINGS
    // ========================================
    USE_MOCK_DATA: false,
    DEBUG: true,

    // ========================================
    // API ENDPOINTS
    // ========================================
    API: {
        BASE_URL: 'http://127.0.0.1:5001/api',
        XGB_BASE_URL: 'http://127.0.0.1:8000',

        CV: {
            UPLOAD: '/cv/upload',
            EXTRACT: '/cv/{id}/extract',
            ANALYZE: '/cv/{id}/analyze',
        },

        ANALYSIS: {
            RESULT: '/analysis/{id}',
            EXPLANATION: '/analysis/{id}/explain',
        },

        JD: {
            UPLOAD: '/jd/upload',
        },

        PREDICT: '/predict',
        FEATURES: '/features',
        PREPROCESS: '/preprocess',
        SCORE: '/score',

        SURVEY: {
            SUBMIT: '/survey/submit',
            GOOGLE_SHEET_URL: 'https://script.google.com/macros/s/AKfycbw5M0_3ofxweZC82ir2VTrluvDqX7QBswpChXI6MvYCJNEQ72XtEnObqGwgxJSvChpB/exec', // Đã cập nhật URL mới
        }
    },

    UI: {
        ANIMATION: {
            FADE: 300,
            SLIDE: 400,
            PROCESSING_STEP: 600,
        },
        SCORE: {
            HIGH: 80,
            MEDIUM: 60,
            LOW: 40,
        }
    },

    FEATURES: {
        ALLOW_CV_EDIT: true,
        SHOW_EXPLANATION: true,
        SHOW_DEVELOPMENT_TIPS: true,
        ENABLE_SURVEY: true,
        DEMO_HR_SIMULATION: true,
    }
};

Config.getApiUrl = function (endpoint, params = {}) {
    let url = this.API.BASE_URL + endpoint;
    Object.keys(params).forEach(key => {
        url = url.replace(`{${key}}`, params[key]);
    });
    return url;
};

Config.getXgbUrl = function (path) {
    const base = (this.API.XGB_BASE_URL || '').replace(/\/$/, '');
    const p = path.startsWith('/') ? path : '/' + path;
    return base + p;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}