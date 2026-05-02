// ========================================
// CV Analysis Service
// Handles CV upload, extraction and analysis logic
// ========================================

const CVAnalysisService = {

    /**
     * Chuỗi cho TF-IDF: form (JSON đã trích + chỉnh trên Screen 2) + toàn văn PDF nếu có (AppState.rawCVText).
     * Sklearn TfidfVectorizer đã gồm tokenization; chỉ cần gửi một text đầy đủ.
     */
    buildPreprocessText(formData, rawCvText) {
        const sc = (formData && formData.skillCategories) || {
            languages: [],
            tools: [],
            hardSkills: [],
            softSkills: []
        };
        const bi = (formData && formData.basicInfo) || {};
        const blocks = [];
        const header = [bi.name, bi.email, bi.phone].filter(Boolean).join(' | ');
        if (header) blocks.push(header);

        const pushBlock = (title, arr) => {
            if (arr && arr.length) {
                blocks.push(`${title}\n${arr.join('\n')}`);
            }
        };
        pushBlock('Languages', sc.languages);
        pushBlock('Tools', sc.tools);
        pushBlock('Hard skills', sc.hardSkills);
        pushBlock('Soft skills', sc.softSkills);
        if (formData && formData.experience && String(formData.experience).trim()) {
            blocks.push(`Experience\n${formData.experience}`);
        }
        if (formData && formData.education && String(formData.education).trim()) {
            blocks.push(`Education\n${formData.education}`);
        }

        let text = blocks.join('\n\n');
        const raw = (rawCvText || '').trim();
        if (raw) {
            const cap = 85000;
            text += `\n\n--- Original CV text (TF-IDF vocabulary) ---\n${raw.length > cap ? raw.slice(0, cap) : raw}`;
        }
        return text;
    },

    buildJDPreprocessText(jdData, rawJdText) {
        if (!jdData) return rawJdText || '';
        const blocks = [];
        if (jdData.jobTitle) blocks.push('Job Title: ' + jdData.jobTitle);
        if (jdData.description) blocks.push('Description\n' + jdData.description);
        if (jdData.responsibilities && jdData.responsibilities.length) {
            blocks.push('Responsibilities\n' + jdData.responsibilities.join('\n'));
        }
        const reqs = jdData.requirements || {};
        if (reqs.education) blocks.push('Required Education: ' + reqs.education);
        if (reqs.experience) blocks.push('Required Experience: ' + reqs.experience);
        if (reqs.skills && reqs.skills.length) {
            blocks.push('Required Skills\n' + reqs.skills.join('\n'));
        }
        if (reqs.certifications && reqs.certifications.length) {
            blocks.push('Certifications\n' + reqs.certifications.join('\n'));
        }
        if (jdData.preferredQualifications && jdData.preferredQualifications.length) {
            blocks.push('Preferred\n' + jdData.preferredQualifications.join('\n'));
        }
        let text = blocks.join('\n\n');
        const raw = (rawJdText || '').trim();
        if (raw) {
            text += '\n\n--- Original JD text ---\n' + (raw.length > 85000 ? raw.slice(0, 85000) : raw);
        }
        return text;
    },

    /**
     * Form Screen 2 → POST /api/score (TF-IDF + XGBoost + SHAP in one call on port 5001)
     */
    async scoreFromEditedForm() {
        const form = Screen2Component.getFormData();
        const fullText = this.buildPreprocessText(form, AppState.rawCVText);

        console.log('[CVService] scoreFromEditedForm — CV text length:', fullText.length);

        const jdText = this.buildJDPreprocessText(AppState.jdData, AppState.jdRawText);
        if (!jdText) {
            console.warn('[CVService] No JD text found — scoring without JD comparison');
        } else {
            console.log('[CVService] JD text length:', jdText.length);
        }

        const cvSkills = [];
        const sc = (form && form.skillCategories) || {};
        ['languages', 'tools', 'hardSkills', 'softSkills'].forEach(function (k) {
            if (Array.isArray(sc[k])) sc[k].forEach(function (s) { if (s) cvSkills.push(s); });
        });
        if (form && form.experience) cvSkills.push(String(form.experience));
        if (form && form.education) cvSkills.push(String(form.education));

        const jdSkills = [];
        const jd = AppState.jdData || {};
        if (jd.jobTitle) jdSkills.push(jd.jobTitle);
        if (jd.description) jdSkills.push(jd.description);
        const jdReqs = jd.requirements || {};
        if (Array.isArray(jdReqs.skills)) jdReqs.skills.forEach(function (s) { if (s) jdSkills.push(s); });
        if (jdReqs.education) jdSkills.push(jdReqs.education);
        if (jdReqs.experience) jdSkills.push(jdReqs.experience);
        if (Array.isArray(jd.responsibilities)) jd.responsibilities.forEach(function (s) { if (s) jdSkills.push(s); });
        if (Array.isArray(jd.preferredQualifications)) jd.preferredQualifications.forEach(function (s) { if (s) jdSkills.push(s); });

        var jdTitle = (AppState.jdData && AppState.jdData.jobTitle) || '(no JD)';
        var cvName = (form && form.basicInfo && form.basicInfo.name) || '(unknown)';
        console.log('[CVService] Scoring: CV="' + cvName + '" vs JD="' + jdTitle + '"');
        console.log('[CVService] Sending', cvSkills.length, 'CV items,', jdSkills.length, 'JD items');

        const scoreUrl = Config.getApiUrl('/score');
        const res = await fetch(scoreUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: fullText,
                jdText: jdText,
                cvSkills: cvSkills,
                jdSkills: jdSkills,
                jobRole: '',
                gender: '',
                race: '',
                age: 28
            })
        });
        const pred = await res.json().catch(function () { return {}; });
        if (!res.ok || pred.success === false) {
            throw new Error(
                pred.message || pred.error || 'Scoring that bai (cong 5001 /api/score)'
            );
        }

        console.log('[CVService] Score result:', pred.score, '% prediction:', pred.prediction);

        var expl = pred.explanation || {};
        var topPos = expl.top_positives || [];
        var topNeg = expl.top_negatives || [];

        var absentHelpful = expl.absent_helpful || [];
        var strengths = this._shapToStrengths(topPos);
        var concerns = this._shapToConcerns(topNeg, pred.score);

        var skillMatch = pred.skill_match || {};
// 🔥 PUSH DATA CHO CHATBOT DÙNG
window.APP_STATE = {
    score: pred.score,
    explanation: pred.explanation,
    top_positives: pred.explanation?.top_positives || [],
    top_negatives: pred.explanation?.top_negatives || [],
    strengths: strengths,
    concerns: concerns
};
        return {
            overallScore: pred.score,
            matchScore: pred.score,
            match_percentage: pred.match_percentage,
            recommendation:
                pred.score >= 80
                    ? 'Hồ sơ phù hợp với vị trí tuyển dụng'
                    : 'Hồ sơ chưa phù hợp với vị trí — cần bổ sung kỹ năng liên quan',
            prediction: pred.prediction,
            probability: pred.probability,
            xgb_score: pred.xgb_score,
            skill_match: skillMatch,
            explanation: expl,
            top_positives: topPos,
            top_negatives: topNeg,
            absent_helpful: absentHelpful,
            strengths: strengths,
            concerns: concerns,
            feature_stats: pred.feature_stats || {},
            reviewedByHR: false
        };
    },

    _shapToStrengths(positives) {
        if (!positives || !positives.length) return ['Không tìm thấy yếu tố nổi bật'];
        var safe = positives.filter(function (p) { return !CVAnalysisService._isProtectedFeature(p.feature); });
        if (!safe.length) return ['Không tìm thấy yếu tố nổi bật'];
        return safe.slice(0, 5).map(function (p) {
            var feat = p.feature || '';
            var impact = typeof p.impact === 'number' ? p.impact : 0;
            var label = CVAnalysisService._featureLabel(feat);
            if (impact > 0.1) return label + ' — đóng góp lớn cho điểm số';
            if (impact > 0.03) return label + ' — ảnh hưởng tích cực';
            return label;
        });
    },

    _shapToConcerns(negatives, score) {
        if (!negatives || !negatives.length) {
            if (score >= 60) return ['Hồ sơ khá tốt, không có điểm yếu rõ rệt'];
            return ['Mô hình chưa tìm thấy nhiều từ khóa phù hợp trong CV'];
        }
        var safe = negatives.filter(function (n) { return !CVAnalysisService._isProtectedFeature(n.feature); });
        if (!safe.length) return ['Hồ sơ khá tốt, không có điểm yếu rõ rệt'];
        return safe.slice(0, 5).map(function (n) {
            var feat = n.feature || '';
            var label = CVAnalysisService._featureLabel(feat);
            return label + ' — ảnh hưởng tiêu cực đến điểm';
        });
    },

    _isProtectedFeature(feat) {
        if (!feat) return false;
        return feat.startsWith('Gender_') || feat.startsWith('Race_') || feat === 'Age_Scaled';
    },

    _featureLabel(feat) {
        if (!feat) return '(unknown)';
        if (feat === 'CV_JD_Similarity') return 'Mức độ tương đồng CV–JD';
        if (feat.startsWith('Job Roles_')) return 'Vai trò: ' + feat.replace('Job Roles_', '');
        if (feat.startsWith('cv_')) return 'CV: từ khóa "' + feat.replace('cv_', '') + '"';
        if (feat.startsWith('jd_')) return 'JD: từ khóa "' + feat.replace('jd_', '') + '"';
        return 'Từ khóa "' + feat + '"';
    },

    async uploadCV(file) {
        if (Config.DEBUG) console.log('[CVService] Uploading:', file.name);

        if (Config.USE_MOCK_DATA) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const processed = await PDFService.processCV(file);
            const cvId = `cv_${Date.now()}_${file.name}`;

            AppState.currentCVId = cvId;
            AppState.rawCVText = processed.rawText;
            AppState.cvTokens = processed.tokens;
            AppState.parsedCVData = processed.parsedCVData;
            AppState.fileInfo = processed.fileInfo;

            return { success: true, cvId, message: 'Upload + extract successful' };
        }

        const formData = new FormData();
        formData.append('file', file);
        return await ApiService.upload(Config.getApiUrl(Config.API.CV.UPLOAD), formData);
    },

    async extractInfo(cvId) {
        if (Config.DEBUG) console.log('[CVService] Extracting info for:', cvId);

        if (Config.USE_MOCK_DATA) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (AppState.currentCVId === cvId && AppState.parsedCVData) {
                return AppState.parsedCVData;
            }
            try {
                const defaultResp = await fetch('data/mocks/cv/default.json');
                return await defaultResp.json();
            } catch (error) {
                throw new Error('Khong the lay du lieu CV da trich xuat');
            }
        }

        return await ApiService.get(Config.getApiUrl(Config.API.CV.EXTRACT, { id: cvId }));
    },

    async analyzeCV(cvId) {
        if (Config.DEBUG) console.log('[CVService] Analyzing:', cvId);

        if (Config.USE_MOCK_DATA) {
            await new Promise(resolve => setTimeout(resolve, 1200));

            const parsed = AppState.parsedCVData || {};
            const sc = parsed.skillCategories || {};
            const skills = [
                ...(sc.languages || []),
                ...(sc.tools || []),
                ...(sc.hardSkills || []),
                ...(sc.softSkills || [])
            ];
            const tokenCount = (AppState.cvTokens || []).length;
            const strongSkills = ['python', 'sql', 'javascript', 'react', 'excel', 'power bi', 'communication'];
            const matchedSkills = skills.filter(skill =>
                strongSkills.includes(String(skill).toLowerCase())
            );
            const score = Math.min(95, 50 + matchedSkills.length * 8 + (tokenCount > 200 ? 10 : 0));

            return {
                overallScore: score,
                recommendation: score >= 75
                    ? 'Hồ sơ phù hợp để xem xét tiếp'
                    : 'Hồ sơ cần bổ sung hoặc chưa đạt tiêu chí',
                strengths: matchedSkills.length
                    ? matchedSkills.map(skill => `Có kỹ năng ${skill}`)
                    : [],
                concerns: [],
                matchedSkills,
                missingSkills: strongSkills.filter(skill => !matchedSkills.includes(skill)).slice(0, 5),
                note: ''
            };
        }

        return await CVAnalysisService.scoreFromEditedForm();
    },

    /**
     * Build feature vector (721 dims) tu raw CV text + parsed data
     * Khop voi feature_names_full.pkl:
     *   [0..668] = keyword bag-of-words
     *   [669..719] = Job Roles one-hot (51 roles)
     *   [720] = Age_Scaled
     */
    buildFeatureVector(parsedCV, rawText, featureNames) {
        // 1. Tokenize raw text
        const tokens = new Set(
            (rawText || '')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(t => t.length > 1)
        );

        // 2. Job role detection
        const allText = (rawText || '').toLowerCase();
        const jobTitles = (parsedCV.experience || []).map(e => (e.title || '').toLowerCase());

        const JOB_ROLE_MAP = {
            'Job Roles_AI Researcher': ['ai researcher'],
            'Job Roles_AI Specialist': ['ai specialist'],
            'Job Roles_Accountant': ['accountant', 'accounting'],
            'Job Roles_Architect': ['architect'],
            'Job Roles_Biomedical Engineer': ['biomedical engineer'],
            'Job Roles_Business Analyst': ['business analyst'],
            'Job Roles_Chef': ['chef', 'cook'],
            'Job Roles_Civil Engineer': ['civil engineer'],
            'Job Roles_Cloud Architect': ['cloud architect'],
            'Job Roles_Construction Manager': ['construction manager'],
            'Job Roles_Content Writer': ['content writer', 'copywriter'],
            'Job Roles_Creative Director': ['creative director'],
            'Job Roles_Customer Service Representative': ['customer service'],
            'Job Roles_Cybersecurity Analyst': ['cybersecurity', 'security analyst'],
            'Job Roles_Data Analyst': ['data analyst'],
            'Job Roles_Database Administrator': ['database administrator', 'dba'],
            'Job Roles_Dentist': ['dentist'],
            'Job Roles_Electrician': ['electrician'],
            'Job Roles_Environmental Scientist': ['environmental scientist'],
            'Job Roles_Event Planner': ['event planner'],
            'Job Roles_Financial Analyst': ['financial analyst'],
            'Job Roles_Fitness Coach': ['fitness coach'],
            'Job Roles_Graphic Designer': ['graphic designer'],
            'Job Roles_HR Specialist': ['hr specialist', 'human resources'],
            'Job Roles_Journalist': ['journalist', 'reporter'],
            'Job Roles_Lawyer': ['lawyer', 'attorney'],
            'Job Roles_Legal Consultant': ['legal consultant'],
            'Job Roles_Machine Learning Engineer': ['machine learning engineer', 'ml engineer'],
            'Job Roles_Marketing Manager': ['marketing manager'],
            'Job Roles_Mechanical Engineer': ['mechanical engineer'],
            'Job Roles_Nurse': ['nurse', 'nursing'],
            'Job Roles_Operations Manager': ['operations manager'],
            'Job Roles_Personal Trainer': ['personal trainer'],
            'Job Roles_Pharmacist': ['pharmacist'],
            'Job Roles_Physician': ['physician', 'doctor'],
            'Job Roles_Pilot': ['pilot', 'aviation'],
            'Job Roles_Product Manager': ['product manager'],
            'Job Roles_Psychologist': ['psychologist'],
            'Job Roles_Research Scientist': ['research scientist'],
            'Job Roles_Robotics Engineer': ['robotics engineer'],
            'Job Roles_SEO Specialist': ['seo specialist', 'seo'],
            'Job Roles_Sales Representative': ['sales representative', 'sales rep'],
            'Job Roles_Social Worker': ['social worker'],
            'Job Roles_Software Engineer': ['software engineer', 'software developer', 'developer'],
            'Job Roles_Supply Chain Manager': ['supply chain'],
            'Job Roles_Systems Analyst': ['systems analyst'],
            'Job Roles_Teacher': ['teacher', 'instructor', 'lecturer'],
            'Job Roles_UX Designer': ['ux designer', 'ui designer'],
            'Job Roles_Urban Planner': ['urban planner'],
            'Job Roles_Veterinarian': ['veterinarian', 'vet'],
            'Job Roles_Web Developer': ['web developer', 'frontend developer', 'backend developer'],
        };

        // 3. Uoc tinh tuoi
        const ageMatch = (rawText || '').match(/\b(19[6-9]\d|200[0-9])\b/);
        let ageScaled = 0.22; // default ~28 tuoi
        if (ageMatch) {
            const birthYear = parseInt(ageMatch[1]);
            const age = new Date().getFullYear() - birthYear;
            ageScaled = Math.max(0, Math.min(1, (age - 18) / (65 - 18)));
        }

        // 4. Map theo featureNames
        return featureNames.map(fname => {
            if (fname === 'Age_Scaled') return ageScaled;
            if (fname.startsWith('Job Roles_')) {
                const kws = JOB_ROLE_MAP[fname] || [];
                return kws.some(kw => allText.includes(kw) || jobTitles.some(t => t.includes(kw))) ? 1 : 0;
            }
            return tokens.has(fname.toLowerCase()) ? 1 : 0;
        });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CVAnalysisService;
}

// Patch: them getResult va getExplanation bi thieu
const _CVAnalysisServicePatch = {
    async getResult(analysisId) {
        if (Config.DEBUG) console.log('[CVService] Getting result for:', analysisId);

        if (AppState.analysisResult && !Config.USE_MOCK_DATA) {
            const a = AppState.analysisResult;
            return {
                status: (a.overallScore || a.matchScore || 0) >= 60 ? 'matched' : 'reviewed',
                matchScore: a.overallScore || a.matchScore || 0,
                message: a.recommendation || '',
                strengths: a.strengths || [],
                developmentAreas: a.concerns || [],
                explanation: a.explanation || a.note || '',
                top_positives: a.top_positives || [],
                top_negatives: a.top_negatives || [],
                absent_helpful: a.absent_helpful || (a.explanation || {}).absent_helpful || [],
                feature_stats: a.feature_stats || {},
                reviewedByHR: a.reviewedByHR || false
            };
        }

        if (Config.USE_MOCK_DATA) {
            await new Promise(resolve => setTimeout(resolve, 300));
            const analysis = AppState.analysisResult || {};
            return {
                status: (analysis.overallScore || 0) >= 75 ? 'matched' : 'reviewed',
                matchScore: analysis.overallScore || 0,
                message: analysis.recommendation || '',
                strengths: analysis.strengths || [],
                developmentAreas: analysis.concerns || [],
                explanation: analysis.note || '',
                reviewedByHR: false
            };
        }

        return await ApiService.get(
            Config.getApiUrl(Config.API.ANALYSIS.RESULT, { id: analysisId })
        );
    },

    async getExplanation(analysisId) {
        if (Config.DEBUG) console.log('[CVService] Getting explanation for:', analysisId);

        if (AppState.analysisResult && AppState.analysisResult.explanation) {
            return { explanation: AppState.analysisResult.explanation };
        }

        if (Config.USE_MOCK_DATA) {
            await new Promise(resolve => setTimeout(resolve, 300));
            return { explanation: '' };
        }

        return await ApiService.get(
            Config.getApiUrl(Config.API.ANALYSIS.EXPLANATION, { id: analysisId })
        );
    }
};

Object.assign(CVAnalysisService, _CVAnalysisServicePatch);
