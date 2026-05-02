const Screen2Component = {
    _bound: false,

    async init() {
        console.log('[Screen2] init called');
        this._bindOnce();
        var cb = document.getElementById('confirmDataCheckbox');
        if (cb) cb.checked = false;
        this._fillForm();
    },

    _bindOnce() {
        if (this._bound) return;
        this._bound = true;
        var self = this;

        var btn = document.getElementById('btnSubmitCV');
        var cb = document.getElementById('confirmDataCheckbox');

        if (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                console.log('[Screen2] btnSubmitCV clicked');
                if (typeof window.submitCVGoToScreen3 === 'function') {
                    window.submitCVGoToScreen3();
                } else {
                    console.error('[Screen2] submitCVGoToScreen3 not on window');
                    App.goToScreen(3);
                }
            });
        }

        if (cb && btn) {
            btn.disabled = true;
            cb.addEventListener('change', function () {
                self._syncSubmitButton();
            });
        }
    },

    _fillForm() {
        this._syncSubmitButton();

        if (AppState.uploadedFile) this._showPdf(AppState.uploadedFile);

        const data = AppState.parsedCVData;
        console.log('[Screen2] parsedCVData =', data);

        if (!data) {
            console.warn('[Screen2] No parsedCVData!');
            return;
        }

        // Basic info
        const bi = data.basicInfo || {};
        this._setVal('#screen2 input[data-field="name"]', bi.name || '');
        this._setVal('#screen2 input[data-field="email"]', bi.email || '');
        this._setVal('#screen2 input[data-field="phone"]', bi.phone || '');

        // Skills — read DIRECTLY from data.skillCategories
        const sc = data.skillCategories || {};
        console.log('[Screen2] skillCategories =', sc);
        console.log('[Screen2] languages:', sc.languages);
        console.log('[Screen2] tools:', sc.tools);
        console.log('[Screen2] hardSkills:', sc.hardSkills);
        console.log('[Screen2] softSkills:', sc.softSkills);

        this._fillChips('skillChipsLanguages', 'fieldSkillLanguages', sc.languages || []);
        this._fillChips('skillChipsTools', 'fieldSkillTools', sc.tools || []);
        this._fillChips('skillChipsHard', 'fieldSkillHard', sc.hardSkills || []);
        this._fillChips('skillChipsSoft', 'fieldSkillSoft', sc.softSkills || []);

        // Experience + Education
        this._setVal('#screen2 textarea[data-field="experience"]', String(data.experience || ''));
        this._setVal('#screen2 textarea[data-field="education"]', String(data.education || ''));

        AppState.confirmedCVData = data;
    },

    _setVal(selector, v) {
        const el = document.querySelector(selector);
        if (el) el.value = v;
    },

    _fillChips(containerId, hiddenId, items) {
        console.log('[Screen2] _fillChips', containerId, items ? items.length : 0, 'items');

        const container = document.getElementById(containerId);
        const hidden = document.getElementById(hiddenId);

        if (hidden) {
            hidden.value = items.join('\n');
        }

        if (!container) {
            console.error('[Screen2] Container NOT FOUND:', containerId);
            return;
        }

        // Clear
        while (container.firstChild) container.removeChild(container.firstChild);

        if (!items || items.length === 0) {
            var empty = document.createElement('span');
            empty.className = 'skill-chips-empty';
            empty.textContent = 'Chưa có dữ liệu';
            container.appendChild(empty);
            return;
        }

        for (var i = 0; i < items.length; i++) {
            var chip = document.createElement('span');
            chip.className = 'skill-chip';
            chip.textContent = items[i];
            container.appendChild(chip);
        }
    },

    _showPdf(file) {
        var doc = document.querySelector('#screen2 .cv-document');
        if (!doc || !file) return;
        var el = document.getElementById('cvFilenameDisplay');
        if (el) el.textContent = file.name ? ' — ' + file.name : '';
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
            var url = URL.createObjectURL(file);
            doc.innerHTML = '<iframe src="' + url + '" width="100%" height="100%" title="CV"></iframe>';
            this._pdfUrl = url;
        }
    },

    cleanup() {
        if (this._pdfUrl) { URL.revokeObjectURL(this._pdfUrl); this._pdfUrl = null; }
    },

    getFormData() {
        var lines = function(id) {
            var el = document.getElementById(id);
            if (!el) return [];
            return el.value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
        };
        return {
            basicInfo: {
                name: (document.querySelector('#screen2 input[data-field="name"]') || {}).value || '',
                email: (document.querySelector('#screen2 input[data-field="email"]') || {}).value || '',
                phone: (document.querySelector('#screen2 input[data-field="phone"]') || {}).value || ''
            },
            skillCategories: {
                languages: lines('fieldSkillLanguages'),
                tools: lines('fieldSkillTools'),
                hardSkills: lines('fieldSkillHard'),
                softSkills: lines('fieldSkillSoft')
            },
            experience: (document.querySelector('#screen2 textarea[data-field="experience"]') || {}).value || '',
            education: (document.querySelector('#screen2 textarea[data-field="education"]') || {}).value || '',
            confirmedAt: new Date().toISOString()
        };
    },

    syncParsedDataFromForm() {
        var fd = this.getFormData();
        AppState.parsedCVData = Object.assign({}, AppState.parsedCVData, fd);
        return fd;
    },

    validate() {
        return { isValid: true, errors: [] };
    },

    _syncSubmitButton() {
        var cb = document.getElementById('confirmDataCheckbox');
        var btn = document.getElementById('btnSubmitCV');
        if (cb && btn) btn.disabled = !cb.checked;
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = Screen2Component;
