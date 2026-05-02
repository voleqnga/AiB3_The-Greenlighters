// ========================================
// PDF Service - Extract text + tokenize + basic CV parsing
// Frontend-only for demo
// ========================================

const PDFService = {
    currentPDFUrl: null,

    /** Anthropic API key (browser direct access — rotate if exposed publicly) */
    ANTHROPIC_API_KEY:
        '',

    validateFile(file) {
    const errors = [];

    if (!file) {
        errors.push('Vui lòng chọn file');
        return { isValid: false, errors };
    }

    const fileName = (file.name || '').toLowerCase().trim();
    const mimeType = (file.type || '').toLowerCase().trim();

    const isPdfByMime = mimeType === 'application/pdf';
    const isPdfByExtension = fileName.endsWith('.pdf');

    if (!isPdfByMime && !isPdfByExtension) {
        errors.push('Chỉ chấp nhận file PDF (.pdf)');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        errors.push('File không được vượt quá 10MB');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
},

    async processCV(file) {
        const validation = this.validateFile(file);
        if (!validation.isValid) {
            throw new Error(validation.errors[0]);
        }

        const uploadUrl = Config.getApiUrl(Config.API.CV.UPLOAD);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(uploadUrl, { method: 'POST', body: formData });
            const data = await response.json().catch(() => ({}));

            if (response.ok && data.success) {
                return this._resultFromServerUpload(file, data);
            }

            const msg = (data && data.message) || '';
            const useBrowserFallback =
                response.status === 503 ||
                /ANTHROPIC|anthropic_key|Thieu.*API/i.test(msg);

            if (useBrowserFallback) {
                if (Config.DEBUG) {
                    console.warn('[PDFService] Server không có ANTHROPIC_API_KEY — fallback trình duyệt');
                }
                if (typeof Helpers !== 'undefined' && Helpers.showToast) {
                    Helpers.showToast(
                        'Server chưa cấu hình Claude (export ANTHROPIC_API_KEY hoặc file anthropic_key.txt). Đang trích xuất trên trình duyệt.',
                        'info'
                    );
                }
                return await this.processCVInBrowser(file);
            }

            const isWrongDoc = data && data.errorType === 'wrong_document';
            if (isWrongDoc) {
                throw new Error(msg || 'Sai loại file. Vui lòng upload đúng file CV.');
            }
            throw new Error(msg || `Upload thất bại (HTTP ${response.status})`);
        } catch (err) {
            if (err && err.message && /không phải|wrong_document|Sai loại/i.test(err.message)) {
                throw err;
            }
            const net =
                err &&
                (err.name === 'TypeError' ||
                    /fetch|Failed to fetch|NetworkError|Load failed/i.test(String(err.message || '')));
            if (net) {
                if (typeof Helpers !== 'undefined' && Helpers.showToast) {
                    Helpers.showToast('Không gọi được :5001 — đang trích xuất PDF trên trình duyệt.', 'info');
                }
                return await this.processCVInBrowser(file);
            }
            throw err;
        }
    },

    /** Chuẩn hóa JSON từ Flask — không dùng cả object response làm payload (tránh lẫn success/rawText). */
    _unwrapUploadPayload(data) {
        if (!data || typeof data !== 'object') return {};
        let payload = data.data;
        if (payload == null && (data.basicInfo || data.skillCategories || data.skills)) {
            payload = {
                basicInfo: data.basicInfo,
                skillCategories: data.skillCategories,
                skills: data.skills,
                experience: data.experience,
                education: data.education
            };
        }
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (e) {
                payload = {};
            }
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            payload = {};
        }
        if (!payload.skillCategories && !payload.skill_categories && data.skillCategories) {
            payload = { ...payload, skillCategories: data.skillCategories };
        }
        if (!payload.basicInfo && !payload.basic_info && data.basicInfo) {
            payload = { ...payload, basicInfo: data.basicInfo };
        }
        return payload;
    },

    /** Phản hồi chuẩn từ POST /api/cv/upload (Flask đã có Claude + lưu file) */
    _resultFromServerUpload(file, data) {
        const rawText = data.rawText || '';
        const tokens = this.tokenizeText(rawText);
        const unwrapped = this._unwrapUploadPayload(data);
        if (Config.DEBUG) {
            const sc = unwrapped.skillCategories || {};
            console.log('[PDFService] unwrapped skillCategories keys:', Object.keys(sc),
                'languages:', (sc.languages || []).length,
                'tools:', (sc.tools || []).length,
                'hardSkills:', (sc.hardSkills || []).length,
                'softSkills:', (sc.softSkills || []).length);
        }
        const parsedCVData = this.normalizeParsedCVData(unwrapped);
        const jsonFileName =
            data.filename || `CV_${Helpers.sanitizeFileComponent(parsedCVData.basicInfo?.name)}.json`;
        const saveToServer = data.saved
            ? { ok: true, filename: data.filename, path: data.path }
            : { ok: false };

        return {
            fileInfo: {
                name: file.name,
                size: file.size,
                type: file.type,
                uploadedAt: new Date().toISOString()
            },
            rawText,
            tokens,
            parsedCVData,
            jsonFileName,
            cvId: data.cvId,
            saveToServer,
            status: 'processed',
            message: 'PDF extracted via server.'
        };
    },

    /**
     * Khi server thiếu key (503) hoặc không chạy: PDF.js + Claude trong browser + thử POST /api/cv/save
     */
    async processCVInBrowser(file) {
        const rawText = await this.extractTextFromPDF(file);
        const tokens = this.tokenizeText(rawText);

        let parsedCVData;
        try {
            const rawParsed = await this.parseCVWithClaude(rawText);
            parsedCVData = this.normalizeParsedCVData(rawParsed);
        } catch (e) {
            console.warn('[PDFService] Claude (browser) failed, regex fallback:', e);
            parsedCVData = this.normalizeParsedCVData(this.parseCVText(rawText, tokens));
        }

        const jsonFileName = `CV_${Helpers.sanitizeFileComponent(parsedCVData.basicInfo?.name)}.json`;
        const payload = {
            filename: jsonFileName,
            basicInfo: parsedCVData.basicInfo,
            skillCategories: parsedCVData.skillCategories,
            experience: parsedCVData.experience,
            education: parsedCVData.education,
            _meta: {
                jsonFileName,
                extractedAt: new Date().toISOString(),
                rawTextLength: (rawText || '').length,
                source: 'browser'
            }
        };
        const saveToServer = await this.saveCVToServer(payload);

        return {
            fileInfo: {
                name: file.name,
                size: file.size,
                type: file.type,
                uploadedAt: new Date().toISOString()
            },
            rawText,
            tokens,
            parsedCVData,
            jsonFileName,
            cvId: null,
            saveToServer,
            status: 'processed',
            message: 'PDF extracted in browser (fallback).'
        };
    },

    _cleanSkillStringList(val) {
        if (!val) return [];
        if (typeof val === 'string') {
            return val
                .split(/[\n,;]/)
                .map(s => s.trim())
                .filter(Boolean);
        }
        if (!Array.isArray(val)) return [];
        const out = [];
        for (const x of val) {
            if (typeof x === 'string' && x.trim()) out.push(x.trim());
            else if (x && (x.name || x.skill)) out.push(String(x.name || x.skill).trim());
        }
        return out;
    },

    flattenSkillCategoriesToLegacy(categories) {
        const cat = categories || {};
        const order = ['languages', 'tools', 'hardSkills', 'softSkills'];
        const out = [];
        for (const key of order) {
            for (const name of cat[key] || []) {
                if (name) out.push({ name, confidence: 100, category: key });
            }
        }
        return out;
    },

    /**
     * Gom kỹ năng cho UI (Screen 2) — skillCategories / skill_categories / skills[] + category.
     */
    extractSkillGroupsForUi(data) {
        const d = data || {};
        const one = x => {
            if (x == null) return '';
            if (typeof x === 'string') return x.trim();
            if (typeof x === 'object' && (x.name != null || x.skill != null)) {
                return String(x.name != null ? x.name : x.skill).trim();
            }
            return String(x).trim();
        };
        const normalizeList = val => {
            if (!val) return [];
            if (typeof val === 'string') {
                return val
                    .split(/[\n,;]/)
                    .map(s => s.trim())
                    .filter(Boolean);
            }
            if (!Array.isArray(val)) return [];
            return val.map(one).filter(Boolean);
        };

        let languages = [];
        let tools = [];
        let hardSkills = [];
        let softSkills = [];

        const sc = d.skillCategories || d.skill_categories;
        if (sc && typeof sc === 'object' && !Array.isArray(sc)) {
            languages = normalizeList(sc.languages);
            tools = normalizeList(sc.tools);
            hardSkills = normalizeList(sc.hardSkills || sc.hard_skills);
            softSkills = normalizeList(sc.softSkills || sc.soft_skills);
        }

        const count = () =>
            languages.length + tools.length + hardSkills.length + softSkills.length;

        if (count() === 0 && Array.isArray(d.skills)) {
            for (const item of d.skills) {
                const name = one(item);
                if (!name) continue;
                const cat =
                    item && typeof item === 'object'
                        ? String(item.category || item.cat || '').toLowerCase()
                        : '';
                if (cat.includes('lang')) languages.push(name);
                else if (cat.includes('tool')) tools.push(name);
                else if (cat.includes('soft')) softSkills.push(name);
                else hardSkills.push(name);
            }
        }

        if (count() === 0 && Array.isArray(d.skills)) {
            for (const item of d.skills) {
                const name = typeof item === 'string' ? item.trim() : one(item);
                if (name) hardSkills.push(name);
            }
        }

        return { languages, tools, hardSkills, softSkills };
    },

    /**
     * Map model / fallback output to a single UI shape: basic + skillCategories + experience + education
     */
    normalizeParsedCVData(raw) {
        const r = raw || {};
        const bi = r.basicInfo || r.basic_info || {};
        const basicInfo = {
            name: String(bi.name || '').trim(),
            email: String(bi.email || '').trim(),
            phone: String(bi.phone || '').trim()
        };

        const skillCategories = this.extractSkillGroupsForUi(r);

        let experience = r.experience;
        if (Array.isArray(experience)) {
            experience = experience
                .map(block => {
                    if (typeof block === 'string') return block.trim();
                    const header = [block.duration, block.title, block.company].filter(Boolean).join(' | ');
                    const lines = [
                        header,
                        block.location ? String(block.location) : '',
                        block.description ? String(block.description) : '',
                        Array.isArray(block.technologies) && block.technologies.length
                            ? `Technologies: ${block.technologies.join(', ')}`
                            : ''
                    ].filter(Boolean);
                    return lines.join('\n');
                })
                .filter(Boolean)
                .join('\n\n');
        } else {
            experience = String(experience || '').trim();
        }

        let education = r.education;
        if (Array.isArray(education)) {
            education = education
                .map(ed => {
                    if (typeof ed === 'string') return ed.trim();
                    const inst = ed.institution || ed.school || '';
                    const year = ed.graduationYear || ed.year || '';
                    const rest = [ed.degree, ed.field].filter(Boolean).join(', ');
                    const parts = [inst, rest, year].filter(Boolean);
                    return parts.join(' — ');
                })
                .filter(Boolean)
                .join('; ');
        } else {
            education = String(education || '').trim();
        }

        return { basicInfo, skillCategories, experience, education };
    },

    async parseCVWithClaude(rawText) {
        const key = (this.ANTHROPIC_API_KEY || '').trim();
        if (!key) {
            throw new Error('Missing Anthropic API key.');
        }

        const textSlice = rawText.length > 90000 ? rawText.slice(0, 90000) : rawText;

        const prompt = `You are a CV data extractor. Read the CV text below and return ONLY valid JSON (no markdown fences, no commentary).

Rules:
- IMPORTANT: Keep the ORIGINAL language of the CV. If the CV is in Vietnamese, output Vietnamese. If in English, output English. Do NOT translate.
- Plain text only; no decorative symbols.
- JSON has EXACTLY 4 keys (NO "skills" key — only "skillCategories"):
1) "basicInfo": { "name", "email", "phone" } — use "" if missing.
2) "skillCategories": object with FOUR arrays of strings. Include EVERY skill mentioned anywhere in the CV. Do not cap or omit. Use [] only if nothing.
   - "languages": spoken/written languages with proficiency if stated (e.g. "English — Professional").
   - "tools": software, IDEs, Git, cloud, BI, Office, design tools, OS.
   - "hardSkills": programming languages, frameworks, testing methods, domain skills, methodologies.
   - "softSkills": teamwork, leadership, communication, problem-solving, etc.
3) "experience": ONE string — all jobs; "Dates\\nCompany — Title\\nDescription". Blank line between companies.
4) "education": ONE short string — ONLY school names, degree/major, and graduation years. Separate with "; ". Do NOT list individual course names or subjects.

CV TEXT:
${textSlice}`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5',
                max_tokens: 8192,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`Claude API error: ${response.status} ${errBody.slice(0, 200)}`);
        }

        const data = await response.json();
        let text = data.content[0].text.trim();
        text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(text);
    },

    _pdfJsLoadPromise: null,

    /** Chỉ tải PDF.js khi cần fallback trình duyệt — tránh CSP / eval cảnh báo khi chỉ dùng server :5001 */
    ensurePdfJsLoaded() {
        if (typeof pdfjsLib !== 'undefined') {
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            return Promise.resolve();
        }
        if (this._pdfJsLoadPromise) return this._pdfJsLoadPromise;
        this._pdfJsLoadPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.async = true;
            s.crossOrigin = 'anonymous';
            s.onload = () => {
                if (typeof pdfjsLib !== 'undefined') {
                    pdfjsLib.GlobalWorkerOptions.workerSrc =
                        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                }
                resolve();
            };
            s.onerror = () => reject(new Error('Không tải được PDF.js (CDN). Kiểm tra mạng hoặc CSP.'));
            document.head.appendChild(s);
        });
        return this._pdfJsLoadPromise;
    },

    async waitForPdfJs(timeout = 15000) {
        return Promise.race([
            this.ensurePdfJsLoaded(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('PDF.js timeout')), timeout)
            )
        ]);
    },

    async extractTextFromPDF(file) {
        await this.waitForPdfJs();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const pageTexts = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const textItems = textContent.items
                .map(item => item.str)
                .filter(Boolean);

            pageTexts.push(textItems.join(' '));
        }

        return pageTexts
            .join('\n')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    },

    tokenizeText(text) {
        if (!text) return [];

        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // remove accents
            .replace(/[^a-z0-9@.+#/\-\s]/g, ' ')
            .split(/\s+/)
            .map(t => t.trim())
            .filter(Boolean);
    },

    parseCVText(rawText, tokens = []) {
        const lines = rawText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        const lowerText = rawText.toLowerCase();

        const email = this.extractEmail(rawText);
        const phone = this.extractPhone(rawText);
        const name = this.extractName(lines, email, phone);
        const skills = this.extractSkills(tokens);
        const experience = this.extractExperience(lines, lowerText);
        const education = this.extractEducation(lines, lowerText);

        return {
            basicInfo: {
                name: name || '',
                email: email || '',
                phone: phone || ''
            },
            skills: skills.map(skill => ({
                name: skill,
                confidence: 92
            })),
            experience,
            education,
            rawText
        };
    },

    extractEmail(text) {
        const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        return match ? match[0] : '';
    },

    extractPhone(text) {
        const match = text.match(/(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?[\d\s.-]{7,15}/);
        if (!match) return '';
        return match[0].replace(/\s+/g, ' ').trim();
    },

    extractName(lines, email, phone) {
        for (const line of lines.slice(0, 8)) {
            const clean = line.trim();

            if (!clean) continue;
            if (email && clean.includes(email)) continue;
            if (phone && clean.includes(phone)) continue;
            if (clean.length < 3 || clean.length > 60) continue;
            if (/\d/.test(clean)) continue;
            if (/@/.test(clean)) continue;

            // skip common section headers
            const lower = clean.toLowerCase();
            const blocked = [
                'curriculum vitae', 'cv', 'resume', 'profile', 'summary',
                'education', 'experience', 'skills', 'contact', 'objective'
            ];
            if (blocked.includes(lower)) continue;

            return clean;
        }
        return '';
    },

    extractSkills(tokens) {
        const skillDictionary = [
            'python', 'java', 'javascript', 'typescript', 'sql', 'mysql', 'postgresql',
            'excel', 'power bi', 'tableau', 'html', 'css', 'react', 'nodejs', 'node',
            'flask', 'fastapi', 'django', 'git', 'github', 'docker', 'aws', 'azure',
            'machine learning', 'deep learning', 'nlp', 'tensorflow', 'pytorch',
            'pandas', 'numpy', 'scikit-learn', 'data analysis', 'data analytics',
            'communication', 'teamwork', 'leadership', 'problem solving',
            'english', 'agile', 'scrum', 'figma', 'canva', 'word', 'powerpoint'
        ];

        const joined = tokens.join(' ');
        const found = [];

        for (const skill of skillDictionary) {
            if (skill.includes(' ')) {
                if (joined.includes(skill)) found.push(skill);
            } else {
                if (tokens.includes(skill)) found.push(skill);
            }
        }

        return [...new Set(found)];
    },

    extractExperience(lines, lowerText) {
        const expSection = this.extractSection(lines, [
            'experience', 'work experience', 'employment history',
            'kinh nghiệm', 'kinh nghiem'
        ], [
            'education', 'skills', 'projects', 'certifications',
            'học vấn', 'hoc van'
        ]);

        if (expSection.length === 0) {
            return [{
                title: '',
                company: '',
                duration: '',
                description: ''
            }];
        }

        const firstLine = expSection[0] || '';
        return [{
            title: firstLine,
            company: '',
            duration: '',
            description: expSection.slice(1, 4).join(' ')
        }];
    },

    extractEducation(lines, lowerText) {
        const eduSection = this.extractSection(lines, [
            'education', 'academic background', 'học vấn', 'hoc van'
        ], [
            'experience', 'skills', 'projects', 'certifications',
            'kinh nghiệm', 'kinh nghiem'
        ]);

        if (eduSection.length === 0) {
            return [{
                degree: '',
                field: '',
                institution: '',
                graduationYear: ''
            }];
        }

        const firstLine = eduSection[0] || '';
        const yearMatch = firstLine.match(/\b(19|20)\d{2}\b/);

        return [{
            degree: firstLine,
            field: '',
            institution: eduSection[1] || '',
            graduationYear: yearMatch ? yearMatch[0] : ''
        }];
    },

    extractSection(lines, startKeywords, endKeywords) {
        let startIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const lower = lines[i].toLowerCase();
            if (startKeywords.some(k => lower.includes(k))) {
                startIndex = i + 1;
                break;
            }
        }

        if (startIndex === -1) return [];

        const section = [];
        for (let i = startIndex; i < lines.length; i++) {
            const lower = lines[i].toLowerCase();
            if (endKeywords.some(k => lower.includes(k))) break;
            section.push(lines[i]);
        }

        return section.filter(Boolean).slice(0, 8);
    },

    async displayPDF(file, options = {}) {
        const {
            containerId = 'cvDocumentViewer',
            iframeId = 'pdfViewer',
            placeholderId = 'pdfPlaceholder',
            filenameDisplayId = 'cvFilenameDisplay'
        } = options;

        try {
            const validation = this.validateFile(file);
            if (!validation.isValid) {
                throw new Error(validation.errors[0]);
            }

            const container = document.getElementById(containerId);
            const iframe = document.getElementById(iframeId);
            const placeholder = document.getElementById(placeholderId);
            const filenameDisplay = document.getElementById(filenameDisplayId);

            if (!container || !iframe) {
                console.error('[PDFService] PDF viewer elements not found');
                return false;
            }

            this.cleanup();
            this.currentPDFUrl = URL.createObjectURL(file);

            if (placeholder) {
                placeholder.style.display = 'none';
            }

            iframe.src = this.currentPDFUrl;
            iframe.style.display = 'block';

            if (filenameDisplay) {
                filenameDisplay.textContent = file.name;
                filenameDisplay.title = file.name;
            }

            if (Config.DEBUG) {
                console.log('[PDFService] PDF displayed:', file.name);
            }

            return true;

        } catch (error) {
            console.error('[PDFService] Error displaying PDF:', error);
            return false;
        }
    },

    displayPDFFromUrl(url, filename = 'CV.pdf', options = {}) {
        const {
            iframeId = 'pdfViewer',
            placeholderId = 'pdfPlaceholder',
            filenameDisplayId = 'cvFilenameDisplay'
        } = options;

        try {
            const iframe = document.getElementById(iframeId);
            const placeholder = document.getElementById(placeholderId);
            const filenameDisplay = document.getElementById(filenameDisplayId);

            if (!iframe) {
                console.error('[PDFService] PDF iframe not found');
                return false;
            }

            if (placeholder) {
                placeholder.style.display = 'none';
            }

            iframe.src = url;
            iframe.style.display = 'block';

            if (filenameDisplay) {
                filenameDisplay.textContent = filename;
                filenameDisplay.title = filename;
            }

            return true;

        } catch (error) {
            console.error('[PDFService] Error displaying PDF from URL:', error);
            return false;
        }
    },

    hidePDF(options = {}) {
        const {
            iframeId = 'pdfViewer',
            placeholderId = 'pdfPlaceholder',
            filenameDisplayId = 'cvFilenameDisplay'
        } = options;

        const iframe = document.getElementById(iframeId);
        const placeholder = document.getElementById(placeholderId);
        const filenameDisplay = document.getElementById(filenameDisplayId);

        if (iframe) {
            iframe.style.display = 'none';
            iframe.src = '';
        }

        if (placeholder) {
            placeholder.style.display = 'block';
        }

        if (filenameDisplay) {
            filenameDisplay.textContent = '';
        }

        this.cleanup();
    },

    /**
     * Lưu JSON vào thư mục output/ của Flask (không dùng download trình duyệt)
     * @returns {{ ok: boolean, filename?: string, message?: string }}
     */
    async saveCVToServer(payload) {
        try {
            const response = await fetch(Config.getApiUrl('/cv/save'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));
            if (response.ok && result.success) {
                if (Config.DEBUG) console.log('[PDFService] CV saved:', result.filename, result.path);
                return {
                    ok: true,
                    filename: result.filename,
                    path: result.path,
                    message: result.message
                };
            }
            return {
                ok: false,
                message: result.message || `HTTP ${response.status}`
            };
        } catch (e) {
            console.warn('[PDFService] Could not save to server:', e.message);
            return { ok: false, message: e.message || 'Network error' };
        }
    },

    cleanup() {
        if (this.currentPDFUrl) {
            URL.revokeObjectURL(this.currentPDFUrl);
            this.currentPDFUrl = null;
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFService;
}