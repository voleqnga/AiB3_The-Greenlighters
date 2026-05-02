const ChatController = {
    async callChatAPI(message, context = {}) {
        try {
            const payload = {
                message: message,
                context: JSON.stringify(this.buildExtendedApiContext(context))
            };
            const response = await fetch('http://localhost:5001/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Unknown error');
            return this.cleanAIResponse(data.reply);
        } catch (error) {
            console.error('[ChatAPI] Error:', error);
            if (context.chatMode === 'APP_HELP') {
                return this.cleanAIResponse(this.staticUnknownReply());
            }
            return 'Hệ thống tư vấn tạm thời không phản hồi. Bạn thử lại sau hoặc kiểm tra server (python3 server.py) đang chạy.';
        }
    },

    /** Gửi kèm API để model bám theo màn hình / tiến độ (không thay thế NEXT_STEP rule-based). */
    buildExtendedApiContext(base) {
        const out = { ...(base || {}) };
        const A = typeof window !== 'undefined' ? window.AppState : null;
        if (A) {
            out.currentScreen = A.currentScreen;
            out.isHR = A.currentScreen === 'HR';
            out.hasUploadedCv = !!(A.currentCVId || A.parsedCVData);
            out.hasAnalysisResult = !!(
                A.analysisResult ||
                (window.APP_STATE && window.APP_STATE.score != null && window.APP_STATE.score !== '')
            );
            out.surveySubmitted = !!A.surveySubmitted;
            out.candidateNoticeView = !!A.candidateNoticeView;
        }
        return out;
    },

    cleanAIResponse(text) {
        if (!text) return 'Chưa có nội dung trả lời.';
        let cleaned = text;
        cleaned = cleaned.replace(/([a-zA-ZÀ-ỹ])([0-9])/g, '$1 $2');
        cleaned = cleaned.replace(/([0-9])([a-zA-ZÀ-ỹ])/g, '$1 $2');
        cleaned = cleaned.replace(/\s{2,}/g, ' ');
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        cleaned = cleaned.replace(/#+/g, '');
        if (cleaned.length > 1200) cleaned = cleaned.slice(0, 1200) + '...';
        return cleaned.trim();
    },

    getGlobalContext() {
        const out = {
            score: null,
            strengths: [],
            weaknesses: [],
            top_positives: [],
            top_negatives: []
        };
        if (window.APP_STATE) {
            out.score = window.APP_STATE.score != null ? window.APP_STATE.score : null;
            out.strengths = window.APP_STATE.strengths || [];
            out.weaknesses = window.APP_STATE.concerns || [];
            out.top_positives = window.APP_STATE.top_positives || [];
            out.top_negatives = window.APP_STATE.top_negatives || [];
        }
        const A = typeof window !== 'undefined' ? window.AppState : null;
        if (A && A.analysisResult) {
            const r = A.analysisResult;
            if (out.score == null && (r.overallScore != null || r.matchScore != null)) {
                out.score = r.overallScore != null ? r.overallScore : r.matchScore;
            }
            if ((!out.strengths || !out.strengths.length) && r.strengths && r.strengths.length) {
                out.strengths = r.strengths;
            }
            if ((!out.weaknesses || !out.weaknesses.length) && r.concerns && r.concerns.length) {
                out.weaknesses = r.concerns;
            }
            const expl = r.explanation || {};
            if ((!out.top_positives || !out.top_positives.length) && expl.top_positives && expl.top_positives.length) {
                out.top_positives = expl.top_positives;
            }
            if ((!out.top_negatives || !out.top_negatives.length) && expl.top_negatives && expl.top_negatives.length) {
                out.top_negatives = expl.top_negatives;
            }
        }
        return out;
    },

    hasAnalysisContext(ctx) {
        if (ctx.score != null && ctx.score !== '' && !Number.isNaN(Number(ctx.score))) return true;
        if (Array.isArray(ctx.strengths) && ctx.strengths.length) return true;
        if (Array.isArray(ctx.weaknesses) && ctx.weaknesses.length) return true;
        if (Array.isArray(ctx.top_positives) && ctx.top_positives.length) return true;
        if (Array.isArray(ctx.top_negatives) && ctx.top_negatives.length) return true;
        if (typeof window !== 'undefined' && window.AppState && window.AppState.analysisResult) return true;
        return false;
    },

    /**
     * Trả lời theo AppState — không cần liệt kê hết mọi câu hỏi trong FAQ.
     */
    getNextStepReply() {
        const A = typeof window !== 'undefined' ? window.AppState : null;
        if (!A) {
            return 'Hãy chọn vai trò trên màn hình đầu (Ứng viên hoặc HR), sau đó làm theo từng bước trên giao diện.';
        }

        if (A.candidateNoticeView) {
            return (
                'Bạn đang xem mục thông báo. Để tiếp tục nộp CV và nhận đánh giá, hãy dùng nút quay lại hoặc điều hướng về luồng ứng viên trên trang.'
            );
        }

        const scr = A.currentScreen;

        if (scr === '0') {
            return (
                'Bước đầu: trên màn hình chào mừng, chọn «Ứng viên» nếu bạn muốn nộp CV và nhận đánh giá phù hợp; chọn «HR» nếu bạn nhập mô tả công việc (JD). ' +
                'Với ứng viên, sau khi chọn vai trò, hệ thống sẽ chuyển sang bước tải CV (PDF).'
            );
        }

        if (scr === 'HR') {
            return (
                'Với vai trò HR: nhập hoặc tải JD trên màn hình hiện tại, sau đó có thể xem danh sách ứng viên đã nộp (theo tab / mục trên giao diện).'
            );
        }

        if (scr === 1) {
            return (
                'Bước hiện tại: tải file CV định dạng PDF bằng chức năng trên màn hình. Sau khi tải, hệ thống trích xuất thông tin để bạn kiểm tra ở bước tiếp theo.'
            );
        }

        if (scr === 2) {
            return (
                'Bạn đang ở bước xem và chỉnh thông tin CV. Kiểm tra kỹ năng, học vấn, kinh nghiệm; sau đó dùng nút gửi để chạy phân tích AI.'
            );
        }

        if (scr === 3) {
            return 'Hệ thống đang phân tích CV — vui lòng đợi đến khi có kết quả trên màn hình.';
        }

        if (scr === 4) {
            const hasResult = !!(A.analysisResult || (window.APP_STATE && window.APP_STATE.score != null));
            if (hasResult) {
                return (
                    'Bạn đã có kết quả phân tích: xem điểm và các gợi ý trên màn hình. ' +
                    'Bạn có thể hỏi chatbot chi tiết về điểm hoặc cách cải thiện CV (sau khi đã có phân tích). ' +
                    'Bước tiếp theo thường là hoàn thành khảo sát trải nghiệm nếu có.'
                );
            }
            return 'Xem kết quả trên màn hình và làm theo nút chuyển bước (ví dụ khảo sát).';
        }

        if (scr === 5) {
            if (A.surveySubmitted) {
                return 'Bạn đã gửi khảo sát. Cảm ơn bạn đã hoàn thành.';
            }
            return 'Vui lòng trả lời các câu khảo sát và gửi để hoàn tất luồng ứng viên.';
        }

        return (
            'Hãy làm theo các bước trên giao diện: tải CV → chỉnh thông tin → phân tích → xem kết quả → khảo sát (nếu có). ' +
            'Nếu cần chỉ dẫn ngắn, hãy hỏi «Tôi nên làm gì tiếp?» sau khi đã chọn vai trò.'
        );
    },

    staticJobInfoReply() {
        return (
            'Thông tin tuyển dụng theo từng vị trí được công bố trên giao diện HR hoặc văn bản tuyển dụng chính thức. ' +
            'Chatbot không thay thế JD chi tiết của tổ chức.'
        );
    },

    staticUnknownReply() {
        return (
            'Tôi chưa hiểu đủ ý câu hỏi. Bạn thử hỏi «Bây giờ tôi phải làm gì?» hoặc «Tôi nên làm gì tiếp?» để nhận chỉ dẫn theo đúng màn hình bạn đang dùng, ' +
            'hoặc chọn một câu gợi ý bên dưới.'
        );
    },

    staticFeedbackReply() {
        return (
            'Để góp ý hoặc khiếu nại, bạn dùng kênh liên hệ do chương trình hoặc HR công bố. ' +
            'Trao đổi qua chatbot không thay thế hồ sơ phản hồi chính thức.'
        );
    },

    needAnalysisFirstReply() {
        return (
            'Để nhận tư vấn theo điểm và nội dung CV, vui lòng hoàn tất bước tải CV và chạy phân tích trên hệ thống, rồi hỏi lại về điểm hoặc gợi ý cải thiện.'
        );
    },

    async getResponse(message, context = {}) {
        const faqMatch = FAQ_DATA.find(faq =>
            faq.keywords.some(k => message.toLowerCase().includes(k))
        );
        if (faqMatch) {
            return this.cleanAIResponse(faqMatch.answer);
        }

        const finalContext = { ...this.getGlobalContext(), ...context };
        const intent = IntentDetector.detect(message);

        if (intent === 'NEXT_STEP') {
            return this.cleanAIResponse(this.getNextStepReply());
        }
        if (intent === 'JOB_INFO') {
            return this.cleanAIResponse(this.staticJobInfoReply());
        }
        if (intent === 'FEEDBACK') {
            return this.cleanAIResponse(this.staticFeedbackReply());
        }
        if (intent === 'UNKNOWN') {
            return await this.callChatAPI(message, {
                ...finalContext,
                chatMode: 'APP_HELP'
            });
        }

        if (intent === 'SCORE' || intent === 'SELF_ANALYSIS') {
            if (!this.hasAnalysisContext(finalContext)) {
                return this.cleanAIResponse(this.needAnalysisFirstReply());
            }
            return await this.callChatAPI(message, finalContext);
        }

        return await this.callChatAPI(message, { ...finalContext, chatMode: 'APP_HELP' });
    },

    handleMessage(message, context = {}) {
        return this.getResponse(message, context);
    }
};
