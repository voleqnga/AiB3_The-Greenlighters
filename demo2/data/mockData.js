// ========================================
// MOCK DATA - FOR DEMO/UI TESTING ONLY
// ========================================

// Survey Questions (Fixed UI)
// Survey Questions (Fixed UI)
const SurveyQuestions = [
    { id: 1, text: 'Khả năng giải thích của AI', category: 'explainability', type: 'rating', required: true },
    { id: 2, text: 'Mức độ minh bạch của quy trình', category: 'transparency', type: 'rating', required: true },
    { id: 3, text: 'Cảm nhận về quyền riêng tư dữ liệu', category: 'privacy', type: 'rating', required: true },
    { id: 4, text: 'Mức độ công bằng của phân tích', category: 'fairness', type: 'rating', required: true },
    { id: 5, text: 'Vai trò kiểm soát của con người', category: 'human_oversight', type: 'rating', required: true },
    { id: 6, text: 'Trải nghiệm quy trình tổng thể', category: 'overall_experience', type: 'rating', required: true },
    { id: 7, text: 'Mức độ hài lòng chung', category: 'satisfaction', type: 'rating', required: true },
    { id: 8, text: 'Cảm nhận khác (không bắt buộc)', category: 'additional', type: 'text', required: false }
];

// Processing steps (Fixed UI)
const ProcessingSteps = [
    { id: 1, text: 'Phân tích CV', status: 'completed' },
    { id: 2, text: 'Đối chiếu yêu cầu công việc', status: 'completed' },
    { id: 3, text: 'Tạo báo cáo phân tích', status: 'completed' },
    { id: 4, text: 'Gửi đến bộ phận nhân sự', status: 'active' }
];

// Note: Mock CV Data is now loaded dynamically from data/mocks/*.json
// See: services/cvAnalysisService.js

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SurveyQuestions,
        ProcessingSteps
    };
}
