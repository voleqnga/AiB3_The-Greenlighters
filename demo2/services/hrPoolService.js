// ========================================
// HR candidate pool — một JD / một pool (không jdId)
// ========================================
const HrPoolService = {
    /**
     * Sau khi chấm điểm — gửi ứng viên vào pool trên server.
     */
    /**
     * @param {object} aiLines — { strengthLines: string[], developmentLines: string[] } từ Screen4 (sau phân tích)
     */
    async submitCandidate(analysisResult, formSnapshot, aiLines) {
        if (!analysisResult) return { success: false, skipped: true };

        const bi = (formSnapshot && formSnapshot.basicInfo) || {};
        const name = (bi.name || '').trim() || 'Ứng viên';
        const email = (bi.email || '').trim();

        // Mỗi lần chấm điểm xong = một ứng viên mới trong pool (không tái dùng id phiên trình duyệt,
        // nếu không mọi CV trong cùng tab sẽ ghi đè một dòng và HR chỉ thấy một hồ sơ).
        var cid = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'cand_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

        var strLines = (aiLines && aiLines.strengthLines) || [];
        var devLines = (aiLines && aiLines.developmentLines) || [];
        if ((!strLines.length || !devLines.length) && typeof Screen4Component !== 'undefined' && Screen4Component.buildAiLinesFromAnalysis) {
            var built = Screen4Component.buildAiLinesFromAnalysis(analysisResult);
            if (!strLines.length) strLines = built.strengthLines || [];
            if (!devLines.length) devLines = built.developmentLines || [];
        }

        var expl = { summary: '', improvement: null };
        if (typeof Screen4Component !== 'undefined' && Screen4Component.buildExplanationFromAnalysis) {
            expl = Screen4Component.buildExplanationFromAnalysis(analysisResult, AppState.jdData || null);
        }

        const body = {
            jobTitle: (AppState.jdData && AppState.jdData.jobTitle) ? AppState.jdData.jobTitle : '',
            candidate: {
                id: cid,
                name: name,
                email: email,
                score: analysisResult.overallScore != null ? analysisResult.overallScore : analysisResult.matchScore,
                recommendation: analysisResult.recommendation || '',
                aiStrengths: strLines,
                aiDevelopment: devLines,
                aiAnalysisSummary: expl.summary || '',
                aiAnalysisImprovement: expl.improvement != null ? expl.improvement : ''
            }
        };

        try {
            const res = await fetch(Config.getApiUrl('/hr/pool/submit'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json().catch(function () { return {}; });
            if (!res.ok || data.success === false) {
                console.warn('[HrPool] submit failed:', data.message || res.status);
                return { success: false, error: data.message };
            }
            var finalId = data.candidateId || cid;
            try {
                sessionStorage.setItem('hr_candidate_id', finalId);
            } catch (e) { /* ignore */ }
            return { success: true, candidateId: finalId };
        } catch (e) {
            console.warn('[HrPool] submit error:', e);
            return { success: false, error: String(e) };
        }
    },

    async fetchCandidateById(candidateId) {
        if (!candidateId) return null;
        try {
            const base = (Config.API.BASE_URL || '').replace(/\/api\/?$/, '');
            const url = base + '/api/hr/candidate/' + encodeURIComponent(candidateId);
            const res = await fetch(url);
            const data = await res.json().catch(function () { return {}; });
            if (!res.ok || data.success === false) return null;
            return data.candidate || null;
        } catch (e) {
            console.warn('[HrPool] fetchCandidateById:', e);
            return null;
        }
    },

    async fetchPool() {
        try {
            const base = (Config.API.BASE_URL || '').replace(/\/api\/?$/, '');
            const url = base + '/api/hr/pool';
            const res = await fetch(url);
            const data = await res.json().catch(function () { return {}; });
            if (!res.ok || data.success === false) return null;
            return data.pool;
        } catch (e) {
            console.warn('[HrPool] fetchPool:', e);
            return null;
        }
    },

    async sendDecision(candidateId, decision, feedback) {
        const res = await fetch(Config.getApiUrl('/hr/decision'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                candidateId: candidateId,
                decision: decision,
                feedback: (feedback || '').trim()
            })
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok || data.success === false) {
            throw new Error(data.message || ('HTTP ' + res.status));
        }
        return data;
    }
};
