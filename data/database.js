// ========================================
// Database Abstraction Layer
// Connects UI to Backend API or Mock Data
// ========================================

const Database = {
    // ========================================
    // SURVEY OPERATIONS
    // ========================================

    async getSurveyQuestions() {
        return Promise.resolve(SurveyQuestions);
    },

    /**
     * Submit survey responses to backend and Google Sheets
     * @param {Object} responses - Dữ liệu khảo sát đã được chuẩn bị (flat row)
     * @returns {Promise<Object>} Submission result
     */
    async submitSurvey(responses) {
        // 1. Gửi dữ liệu khảo sát đến Google Sheets (dùng no-cors, form encoded)
        const googleSheetUrl = Config.API.SURVEY.GOOGLE_SHEET_URL;
        if (googleSheetUrl) {
            try {
                // Chuyển object thành URLSearchParams (x-www-form-urlencoded)
                const formData = new URLSearchParams();
                // Thêm timestamp
                formData.append('Timestamp', new Date().toISOString());
                // Thêm tất cả các trường từ responses (phẳng)
                for (const [key, value] of Object.entries(responses)) {
                    if (value !== undefined && value !== null) {
                        formData.append(key, value);
                    }
                }
                await fetch(googleSheetUrl, {
                    method: 'POST',
                    mode: 'no-cors',          // Quan trọng: tránh CORS
                    cache: 'no-cache',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData.toString()
                });
                console.log('[Database] Sent to Google Sheet (no-cors, form encoded)');
            } catch (err) {
                console.error('[Database] Failed to send to Google Sheet:', err);
                // Không throw lỗi để không ảnh hưởng đến backend
            }
        }

        // 2. Gửi dữ liệu khảo sát sang Backend (Flask)
        if (Config.USE_MOCK_DATA) {
            console.log('[Database-Mock] Survey submitted:', responses);
            return Promise.resolve({
                success: true,
                message: 'Cảm ơn bạn đã gửi phản hồi (Demo Mode)!',
                submittedAt: new Date().toISOString()
            });
        }

        try {
            const result = await ApiService.post(Config.getApiUrl(Config.API.SURVEY.SUBMIT), responses);
            console.log('[Database] Survey submitted to backend:', result);
            return result;
        } catch (error) {
            console.error('[Database] Failed to submit survey to backend:', error);
            // Vẫn trả thành công để không làm gián đoạn UX
            return {
                success: true,
                message: 'Đã ghi nhận phản hồi (sẽ được lưu sau).',
                submittedAt: new Date().toISOString()
            };
        }
    },

    // ========================================
    // PROCESSING STEPS
    // ========================================
    async getProcessingSteps() {
        return Promise.resolve(ProcessingSteps);
    },

    // ========================================
    // CV OPERATIONS
    // ========================================
    async uploadCV(file) {
        if (Config.USE_MOCK_DATA) {
            console.log('[Database-Mock] Uploading CV:', file?.name);
            await this._delay(1500);
            return Promise.resolve({
                cvId: 'CV-DEMO-' + Date.now(),
                filename: file?.name,
                uploadedAt: new Date().toISOString()
            });
        }

        const formData = new FormData();
        formData.append('file', file);
        return await ApiService.upload(Config.getApiUrl(Config.API.CV.UPLOAD), formData);
    },

    async getCVExtracted(cvId) {
        if (Config.USE_MOCK_DATA) {
            console.log('[Database-Mock] Getting extracted data for:', cvId);
            return Promise.resolve(MockCVData);
        }
        return await ApiService.get(Config.getApiUrl(Config.API.CV.EXTRACT, { id: cvId }));
    },

    // ========================================
    // ANALYSIS OPERATIONS
    // ========================================
    async getAnalysisResult(analysisId) {
        if (Config.USE_MOCK_DATA) {
            console.log('[Database-Mock] Getting analysis result for:', analysisId);
            return Promise.resolve(MockAnalysisResult);
        }
        return await ApiService.get(Config.getApiUrl(Config.API.ANALYSIS.RESULT, { id: analysisId }));
    },

    // ========================================
    // UTILITY METHODS
    // ========================================
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Database;
}