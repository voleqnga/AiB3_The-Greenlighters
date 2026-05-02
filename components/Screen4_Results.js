const Screen4Component = {
    async init() {
        if (Config.DEBUG) console.log('[Screen4] Initializing...');
        await this.loadResults();
    },

    async loadResults() {
        try {
            var result = null;

            if (AppState.analysisResult) {
                var a = AppState.analysisResult;
                var score = a.overallScore || a.matchScore || 0;
                result = {
                    status: score >= 80 ? 'matched' : 'reviewed',
                    matchScore: score,
                    prediction: a.prediction,
                    message: a.recommendation || '',
                    strengths: a.strengths || [],
                    developmentAreas: a.concerns || a.developmentAreas || [],
                    explanation: a.explanation || {},
                    top_positives: a.top_positives || [],
                    top_negatives: a.top_negatives || [],
                    absent_helpful: a.absent_helpful || (a.explanation || {}).absent_helpful || [],
                    skill_match: a.skill_match || {},
                    xgb_score: a.xgb_score || 0,
                    feature_stats: a.feature_stats || {},
                    reviewedByHR: a.reviewedByHR || false
                };
            } else if (AppState.analysisId) {
                result = await CVAnalysisService.getResult(AppState.analysisId);
                AppState.analysisResult = result;
            } else { return; }

            if (!result) return;

            this.renderBanner(result.matchScore >= 80, result.message);
            this.renderGauge(result.matchScore);
            this.renderStrengths(result.skill_match, result.top_positives, result.strengths);
            this.renderDevelopment(result.skill_match, result.top_negatives, result.developmentAreas);
            this.renderExplanation(result);
            this.renderHRConfirmation(result.reviewedByHR);
        } catch (error) {
            console.error('[Screen4] Error:', error);
            Helpers.showToast('Không thể tải kết quả phân tích', 'error');
        }
    },

    renderBanner(isSuccess, message) {
        var banner = document.getElementById('resultBanner');
        if (!banner) return;
        var jt = (AppState.jdData && AppState.jdData.jobTitle) ? ' — ' + AppState.jdData.jobTitle : '';
        banner.className = 'result-banner ' + (isSuccess ? 'success' : 'rejected');
        banner.innerHTML = isSuccess
            ? '<h2><span>✅</span> HỒ SƠ PHÙ HỢP VỚI VỊ TRÍ' + Helpers.escapeHtml(jt) + '</h2><p>' + Helpers.escapeHtml(message || 'Hồ sơ của bạn được đánh giá tích cực') + '</p>'
            : '<h2><span>📋</span> HỒ SƠ CẦN CẢI THIỆN THÊM' + Helpers.escapeHtml(jt) + '</h2><p>' + Helpers.escapeHtml(message || 'Hồ sơ chưa đạt ngưỡng — xem gợi ý bên dưới') + '</p>';
    },

    renderGauge(score) {
        var gc = document.querySelector('#screen4 .gauge-circle');
        var gv = document.querySelector('#screen4 .gauge-value');
        if (gc) gc.style.setProperty('--percentage', score);
        if (gv) this._animateNum(gv, 0, score, 1500);
    },

    _animateNum(el, from, to, ms) {
        var t0 = performance.now();
        (function tick(now) {
            var p = Math.min((now - t0) / ms, 1);
            el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))) + '%';
            if (p < 1) requestAnimationFrame(tick);
        })(t0);
    },

    _pickTemplates(templates, count, seed) {
        var shuffled = templates.slice();
        var s = seed || 0;
        for (var i = shuffled.length - 1; i > 0; i--) {
            s = (s * 9301 + 49297) % 233280;
            var j = s % (i + 1);
            var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
        }
        return shuffled.slice(0, count);
    },

    _summarizeSkill(rawItem, viItem) {
        var text = (viItem || rawItem || '').trim();
        if (!text) return '';
        if (text.length <= 60) return text;
        var firstComma = text.indexOf(',');
        if (firstComma > 8 && firstComma < 55) return text.substring(0, firstComma).trim();
        var words = text.split(/\s+/);
        if (words.length > 12) return words.slice(0, 12).join(' ') + '…';
        return text;
    },

    /**
     * Cùng logic với danh sách Screen 4 — dùng để đẩy sang HR pool sau khi phân tích xong.
     */
    computeStrengthsSentences(skillMatch, topPos, fallback) {
        var self = Screen4Component;
        var sentences = [];
        var matched = (skillMatch && skillMatch.matched_details) || [];
        if (matched.length) {
            var seed = 0;
            for (var k = 0; k < matched.length; k++) seed += matched[k].item.length;
            var count = Math.min(matched.length, 5);
            var picks = self._pickTemplates(self._POS_TEMPLATES, count, seed);
            for (var i = 0; i < count; i++) {
                var skill = self._summarizeSkill(matched[i].item, matched[i].item_vi);
                sentences.push(picks[i].replace('{skill}', skill));
            }
        }
        if (!sentences.length && topPos && topPos.length) {
            var filtered = topPos.filter(function (x) { return !self._isProtected(x.feature); });
            var seed2 = filtered.length * 7;
            var count2 = Math.min(filtered.length, 5);
            var picks2 = self._pickTemplates(self._POS_TEMPLATES, count2, seed2);
            for (var j = 0; j < count2; j++) {
                var word = self._humanWordLabeled(filtered[j].feature);
                sentences.push(picks2[j].replace('{skill}', word));
            }
        }
        if (!sentences.length && fallback && fallback.length) {
            sentences = fallback.map(function (s) { return typeof s === 'string' ? s : (s.title || ''); }).filter(Boolean);
        }
        return sentences;
    },

    computeDevelopmentSentences(skillMatch, topNeg, fallback) {
        var self = Screen4Component;
        var sentences = [];
        var unmatched = (skillMatch && skillMatch.unmatched_details) || [];
        if (unmatched.length) {
            var seed = 0;
            for (var k = 0; k < unmatched.length; k++) seed += unmatched[k].item.length;
            var count = Math.min(unmatched.length, 5);
            var picks = self._pickTemplates(self._NEG_TEMPLATES, count, seed + 31);
            for (var i = 0; i < count; i++) {
                var skill = self._summarizeSkill(unmatched[i].item, unmatched[i].item_vi);
                sentences.push(picks[i].replace('{skill}', skill));
            }
        }
        if (!sentences.length && topNeg && topNeg.length) {
            var filtered = topNeg.filter(function (x) { return !self._isProtected(x.feature); });
            var seed2 = filtered.length * 13;
            var count2 = Math.min(filtered.length, 5);
            var picks2 = self._pickTemplates(self._NEG_TEMPLATES, count2, seed2);
            for (var j = 0; j < count2; j++) {
                var word = self._humanWordLabeled(filtered[j].feature);
                sentences.push(picks2[j].replace('{skill}', word));
            }
        }
        if (!sentences.length && fallback && fallback.length) {
            sentences = fallback.map(function (s) { return typeof s === 'string' ? s : (s.title || ''); }).filter(Boolean);
        }
        return sentences;
    },

    /** Sau khi chấm điểm (analysisResult đầy đủ) — dòng hiển thị giống Screen 4 */
    buildAiLinesFromAnalysis(a) {
        if (!a) return { strengthLines: [], developmentLines: [] };
        var skill_match = a.skill_match || {};
        var expl = a.explanation || {};
        var top_positives = expl.top_positives || a.top_positives || [];
        var top_negatives = expl.top_negatives || a.top_negatives || [];
        var strengths = a.strengths || [];
        var concerns = a.concerns || a.developmentAreas || [];
        return {
            strengthLines: this.computeStrengthsSentences(skill_match, top_positives, strengths),
            developmentLines: this.computeDevelopmentSentences(skill_match, top_negatives, concerns)
        };
    },

    /**
     * Cùng nội dung với khối "Giải thích kết quả phân tích" trên Screen4 — đẩy sang HR + file Analysis.
     * @param {object|null} jdData — ví dụ AppState.jdData { jobTitle }
     * @returns {{ summary: string, improvement: string|null }}
     */
    buildExplanationFromAnalysis(a, jdData) {
        if (!a) return { summary: '', improvement: null };
        var self = Screen4Component;
        var score = a.overallScore != null ? a.overallScore : (a.matchScore || 0);
        var sm = a.skill_match || {};
        var smMatched = sm.matched || 0;
        var smTotal = sm.total_jd || 0;
        var hasJD = !!(jdData && jdData.jobTitle);
        var jobTitle = hasJD ? String(jdData.jobTitle) : '';

        var p = '';
        if (hasJD) {
            p += 'Hệ thống đã phân tích hồ sơ của bạn dựa trên yêu cầu của vị trí ' + jobTitle + '. ';
        }
        p += 'Điểm phù hợp tổng thể đạt ' + score + '%';
        if (smTotal > 0) {
            p += ', trong đó CV đáp ứng được ' + smMatched + ' trên ' + smTotal + ' tiêu chí trong mô tả công việc';
        }
        p += '. ';

        if (score >= 80) {
            p += 'Nhìn chung, hồ sơ của bạn đáp ứng tốt các yêu cầu của vị trí này. Bạn có nền tảng phù hợp để ứng tuyển.';
        } else if (score >= 60) {
            p += 'Hồ sơ có nhiều điểm tương đồng nhưng chưa đạt ngưỡng phù hợp. Bạn nên bổ sung thêm kinh nghiệm và kỹ năng liên quan để tăng khả năng trúng tuyển.';
        } else {
            p += 'Hồ sơ chưa phù hợp với vị trí này. Khoảng cách giữa yêu cầu tuyển dụng và hồ sơ còn khá lớn — bạn cần tích lũy thêm kinh nghiệm trong lĩnh vực liên quan.';
        }

        var improvement = null;
        var unmatched = sm.unmatched_details || [];
        if (unmatched.length) {
            var tips = unmatched.slice(0, 3).map(function (u) {
                return self._summarizeSkill(u.item, u.item_vi);
            });
            improvement = 'Gợi ý cải thiện hồ sơ: Một số yêu cầu mà hồ sơ chưa thể hiện rõ: ' + tips.join('; ')
                + '. Hãy bổ sung các kỹ năng hoặc kinh nghiệm liên quan nếu có.';
        }

        return { summary: p, improvement: improvement };
    },

    // ── Điểm nổi bật ──
    renderStrengths(skillMatch, topPos, fallback) {
        var list = document.getElementById('strengthsList');
        if (!list) return;
        var sentences = this.computeStrengthsSentences(skillMatch, topPos, fallback);
        if (!sentences.length) {
            list.innerHTML = '<li>Chưa phát hiện điểm nổi bật.</li>';
            return;
        }
        list.innerHTML = sentences.map(function (s) {
            return '<li><span class="list-icon" style="color:var(--mint-teal);">✓</span><span>' +
                Helpers.escapeHtml(s) + '</span></li>';
        }).join('');
    },

    // ── Hướng phát triển ──
    renderDevelopment(skillMatch, topNeg, fallback) {
        var list = document.getElementById('developmentList');
        if (!list) return;
        var sentences = this.computeDevelopmentSentences(skillMatch, topNeg, fallback);
        if (!sentences.length) {
            list.innerHTML = '<li>Không phát hiện yếu tố tiêu cực rõ rệt.</li>';
            return;
        }
        list.innerHTML = sentences.map(function (s) {
            return '<li><span class="list-icon" style="color:var(--sage-green);">→</span><span>' +
                Helpers.escapeHtml(s) + '</span></li>';
        }).join('');
    },

    // ── Giải thích gọn ──
    renderExplanation(result) {
        var el = document.getElementById('explanationContent');
        if (!el) return;

        var self = Screen4Component;
        var score = result.matchScore || 0;

        var hasJD = !!(AppState.jdData && AppState.jdData.jobTitle);
        var jobTitle = hasJD ? AppState.jdData.jobTitle : '';
        var sm = result.skill_match || {};
        var smMatched = sm.matched || 0;
        var smTotal = sm.total_jd || 0;

        var p = '';
        if (hasJD) {
            p += 'Hệ thống đã phân tích hồ sơ của bạn dựa trên yêu cầu của vị trí <strong>' + Helpers.escapeHtml(jobTitle) + '</strong>. ';
        }
        p += 'Điểm phù hợp tổng thể đạt <strong>' + score + '%</strong>';
        if (smTotal > 0) {
            p += ', trong đó CV đáp ứng được <strong>' + smMatched + ' trên ' + smTotal + '</strong> tiêu chí trong mô tả công việc';
        }
        p += '. ';

        if (score >= 80) {
            p += 'Nhìn chung, hồ sơ của bạn <strong>đáp ứng tốt</strong> các yêu cầu của vị trí này. Bạn có nền tảng phù hợp để ứng tuyển.';
        } else if (score >= 60) {
            p += 'Hồ sơ có nhiều điểm tương đồng nhưng <strong>chưa đạt ngưỡng phù hợp</strong>. Bạn nên bổ sung thêm kinh nghiệm và kỹ năng liên quan để tăng khả năng trúng tuyển.';
        } else {
            p += 'Hồ sơ <strong>chưa phù hợp</strong> với vị trí này. Khoảng cách giữa yêu cầu tuyển dụng và hồ sơ còn khá lớn — bạn cần tích lũy thêm kinh nghiệm trong lĩnh vực liên quan.';
        }

        var html = '<p>' + p + '</p>';

        var unmatched = (sm.unmatched_details || []);
        if (unmatched.length) {
            var tips = unmatched.slice(0, 3).map(function (u) {
                return Helpers.escapeHtml(self._summarizeSkill(u.item, u.item_vi));
            });
            html += '<p style="margin-top:.75rem"><strong>Gợi ý cải thiện hồ sơ:</strong> ';
            html += 'Một số yêu cầu mà hồ sơ chưa thể hiện rõ: <em>' + tips.join('; ') + '</em>. ';
            html += 'Hãy bổ sung các kỹ năng hoặc kinh nghiệm liên quan nếu có.</p>';
        }

        el.innerHTML = html;
    },

    renderHRConfirmation(confirmed, message) {
        var c = document.getElementById('hrConfirmation');
        if (!c) return;
        if (confirmed) {
            c.innerHTML = '<span>✓</span><span>' + (message || 'Kết quả đã được nhân sự xác nhận') + '</span>';
        } else {
            c.innerHTML = '<span>⏳</span><span>' + (message || 'Đang chờ bộ phận nhân sự xem xét') + '</span>';
            c.style.background = 'var(--sage-green-light)';
            c.style.color = 'var(--sage-green)';
        }
    },

    // ======== Sentence templates (varied, 2 câu mỗi template) ========

    _POS_TEMPLATES: [
        'Hồ sơ thể hiện rõ năng lực về {skill}, trùng khớp với yêu cầu tuyển dụng nên giúp bạn nổi bật hơn so với các ứng viên khác.',
        'Bạn có kinh nghiệm liên quan đến {skill}, và đây chính là điều nhà tuyển dụng đang tìm kiếm cho vị trí này.',
        'Kỹ năng {skill} xuất hiện trong cả hồ sơ lẫn mô tả công việc, vì vậy hãy nhấn mạnh thêm điểm này khi phỏng vấn.',
        'Về mặt {skill}, hồ sơ của bạn đáp ứng tốt yêu cầu và đó là lợi thế cạnh tranh đáng kể khi ứng tuyển.',
        'Nhà tuyển dụng đánh giá cao {skill} và hồ sơ của bạn đã thể hiện được năng lực này, cho thấy bạn hoàn toàn có thể đảm nhận công việc.',
        'Yêu cầu về {skill} trong mô tả công việc trùng khớp với kinh nghiệm của bạn, đây là tín hiệu rất tích cực cho quá trình ứng tuyển.',
        'Hồ sơ cho thấy bạn có nền tảng vững chắc về {skill} — vốn là một trong những tiêu chí quan trọng nhất của vị trí này.',
        'Kinh nghiệm của bạn về {skill} cho thấy bạn có thể đóng góp ngay từ những ngày đầu mà không cần nhiều thời gian đào tạo.',
        'Với năng lực về {skill}, bạn đáp ứng được một trong những yêu cầu cốt lõi mà nhà tuyển dụng đặt ra cho vị trí này.',
        'Thế mạnh về {skill} giúp hồ sơ của bạn có lợi thế rõ ràng, đồng thời cho thấy sự phù hợp cao với yêu cầu công việc.',
    ],

    _NEG_TEMPLATES: [
        'Mô tả công việc yêu cầu {skill} nhưng hồ sơ chưa thể hiện rõ, vì vậy bạn nên bổ sung thêm kinh nghiệm hoặc dự án liên quan.',
        'Về phần {skill}, hồ sơ còn thiếu so với yêu cầu nên hãy cân nhắc bổ sung ví dụ cụ thể nếu bạn đã từng làm việc liên quan.',
        'Yêu cầu về {skill} chưa được đáp ứng đầy đủ trong hồ sơ, tuy nhiên bạn có thể cải thiện bằng cách tham gia khóa học hoặc dự án thực tế.',
        'Nhà tuyển dụng cần {skill} nhưng hồ sơ chưa đề cập chi tiết, do đó hãy mô tả rõ hơn nếu bạn đã có kinh nghiệm trong lĩnh vực này.',
        'Hồ sơ chưa phản ánh đầy đủ năng lực về {skill} nên đây là điểm bạn cần ưu tiên cải thiện để tăng khả năng phù hợp.',
        'Về mặt {skill}, khoảng cách giữa yêu cầu và hồ sơ còn khá lớn, bạn cần tích lũy thêm kinh nghiệm thực tế để thu hẹp khoảng cách này.',
        'Tiêu chí {skill} là một trong những yêu cầu của vị trí mà hồ sơ chưa đáp ứng, nếu bổ sung được sẽ giúp cải thiện đáng kể.',
        'Nếu có kinh nghiệm liên quan đến {skill} hãy bổ sung vào hồ sơ vì đây là yêu cầu quan trọng mà nhà tuyển dụng đang tìm kiếm.',
        'Hồ sơ thiếu nội dung về {skill} nên bạn cần cân nhắc bổ sung chứng chỉ hoặc kinh nghiệm liên quan để hoàn thiện hồ sơ.',
        'Yêu cầu về {skill} là một điểm trừ trong hồ sơ hiện tại, hãy cập nhật nếu bạn đã có thêm kinh nghiệm hoặc kỹ năng mới.',
    ],

    // ======== SHAP feature word map (single TF-IDF words only) ========

    _SHAP_WORD_VI: {
        'automation': 'tự động hóa', 'engineering': 'kỹ thuật',
        'management': 'quản lý', 'analysis': 'phân tích',
        'design': 'thiết kế', 'development': 'phát triển',
        'testing': 'kiểm thử', 'customer': 'khách hàng',
        'process': 'quy trình', 'planning': 'lập kế hoạch',
        'leadership': 'lãnh đạo', 'communication': 'giao tiếp',
        'teamwork': 'làm việc nhóm', 'problem': 'giải quyết vấn đề',
        'python': 'Python', 'java': 'Java', 'javascript': 'JavaScript',
        'typescript': 'TypeScript', 'sql': 'SQL', 'excel': 'Excel',
        'html': 'HTML', 'css': 'CSS', 'react': 'React',
        'nodejs': 'Node.js', 'docker': 'Docker', 'aws': 'AWS',
        'azure': 'Azure', 'git': 'Git', 'agile': 'Agile', 'scrum': 'Scrum',
        'risk': 'quản lý rủi ro', 'reporting': 'báo cáo',
        'systems': 'hệ thống', 'methodology': 'phương pháp luận',
        'research': 'nghiên cứu', 'training': 'đào tạo',
        'documentation': 'tài liệu', 'integration': 'tích hợp',
        'performance': 'hiệu suất', 'security': 'bảo mật',
        'database': 'cơ sở dữ liệu', 'microsoft': 'Microsoft',
        'resources': 'nguồn lực', 'building': 'xây dựng',
        'learning': 'học hỏi', 'advanced': 'nâng cao',
        'graphic': 'thiết kế đồ hoạ', 'engineer': 'kỹ sư',
        'architect': 'kiến trúc', 'marketing': 'marketing',
        'finance': 'tài chính', 'project': 'quản lý dự án',
        'data': 'dữ liệu', 'cloud': 'đám mây',
        'mobile': 'di động', 'selenium': 'Selenium',
        'jira': 'Jira', 'confluence': 'Confluence',
        'feedback': 'phản hồi', 'quality': 'chất lượng',
        'implement': 'triển khai', 'support': 'hỗ trợ',
        'monitor': 'giám sát', 'deploy': 'triển khai',
        'collaborate': 'phối hợp', 'optimize': 'tối ưu hóa',
        'troubleshoot': 'xử lý sự cố', 'content': 'nội dung',
        'seo': 'SEO', 'media': 'truyền thông',
        'designer': 'thiết kế', 'counseling': 'tư vấn',
        'bachelors': 'cử nhân', 'innovation': 'đổi mới sáng tạo',
        'knowledge': 'kiến thức', 'experience': 'kinh nghiệm',
    },

    _isProtected(feat) {
        if (!feat) return false;
        return feat.startsWith('Gender_') || feat.startsWith('Race_') || feat === 'Age_Scaled';
    },

    _humanWord(feat) {
        if (!feat) return '—';
        if (feat === 'CV_JD_Similarity') return 'mức tương đồng CV–JD';
        if (feat.startsWith('Job Roles_')) return 'vai trò ' + feat.replace('Job Roles_', '');
        var raw = feat;
        if (raw.startsWith('cv_')) raw = raw.replace('cv_', '');
        if (raw.startsWith('jd_')) raw = raw.replace('jd_', '');
        var key = raw.toLowerCase();
        return this._SHAP_WORD_VI[key] || raw;
    },

    _humanWordLabeled(feat) {
        var word = this._humanWord(feat);
        if (feat && feat.startsWith('jd_')) return word + ' (từ JD)';
        if (feat && feat.startsWith('cv_')) return word + ' (từ CV)';
        return word;
    },

    _filterSkillSuggestions(absentList) {
        if (!absentList || !absentList.length) return [];
        var out = [];
        for (var i = 0; i < absentList.length; i++) {
            var f = absentList[i].feature || '';
            if (this._isProtected(f)) continue;
            if (f === 'CV_JD_Similarity') continue;
            if (f === 'bachelors' || f === 'cv_bachelors' || f === 'jd_bachelors') continue;
            var word = this._humanWordLabeled(f);
            out.push(word);
            if (out.length >= 3) break;
        }
        return out;
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = Screen4Component;
