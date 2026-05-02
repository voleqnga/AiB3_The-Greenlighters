// ========================================
// Screen HR: Upload JD + tab danh sách ứng viên (điểm cao → thấp)
// ========================================
const ScreenHRComponent = (() => {
    let _bound = false;
    let _pool = [];
    let _selectedId = null;
    let _pendingDecision = null;

    function init() {
        if (_bound) return;
        _bound = true;

        const tabFile = document.getElementById('jdTabFile');
        const tabText = document.getElementById('jdTabText');
        const secFile = document.getElementById('jdFileSection');
        const secText = document.getElementById('jdTextSection');

        tabFile?.addEventListener('click', () => {
            tabFile.classList.add('active');
            tabText.classList.remove('active');
            secFile.style.display = '';
            secText.style.display = 'none';
        });
        tabText?.addEventListener('click', () => {
            tabText.classList.add('active');
            tabFile.classList.remove('active');
            secText.style.display = '';
            secFile.style.display = 'none';
        });

        const dropzone = document.getElementById('jdUploadDropzone');
        const fileInput = document.getElementById('jdFileInput');
        const removeBtn = document.getElementById('jdRemoveFile');

        dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone?.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) _handleFile(file);
        });
        fileInput?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) _handleFile(file);
        });
        removeBtn?.addEventListener('click', _resetUpload);

        document.getElementById('jdTextSubmit')?.addEventListener('click', _handleText);

        document.getElementById('hrMainTabJd')?.addEventListener('click', () => _switchMainTab('jd'));
        document.getElementById('hrMainTabPool')?.addEventListener('click', () => _switchMainTab('pool'));

        document.getElementById('hrPoolRefresh')?.addEventListener('click', () => _loadPool(true));
        document.getElementById('hrBtnPass')?.addEventListener('click', () => _openDecisionModal('pass'));
        document.getElementById('hrBtnFail')?.addEventListener('click', () => _openDecisionModal('fail'));
        document.getElementById('hrModalCancel')?.addEventListener('click', _closeModal);
        document.getElementById('hrModalConfirm')?.addEventListener('click', _confirmDecision);
    }

    function _switchMainTab(which) {
        const tabJd = document.getElementById('hrMainTabJd');
        const tabPool = document.getElementById('hrMainTabPool');
        const panelJd = document.getElementById('hrPanelJd');
        const panelPool = document.getElementById('hrPanelPool');

        if (which === 'jd') {
            tabJd?.classList.add('hr-main-nav__btn--active');
            tabPool?.classList.remove('hr-main-nav__btn--active');
            tabJd?.setAttribute('aria-selected', 'true');
            tabPool?.setAttribute('aria-selected', 'false');
            if (panelJd) panelJd.style.display = '';
            if (panelPool) panelPool.style.display = 'none';
        } else {
            tabPool?.classList.add('hr-main-nav__btn--active');
            tabJd?.classList.remove('hr-main-nav__btn--active');
            tabPool?.setAttribute('aria-selected', 'true');
            tabJd?.setAttribute('aria-selected', 'false');
            if (panelJd) panelJd.style.display = 'none';
            if (panelPool) panelPool.style.display = '';
            _loadPool(false);
        }
    }

    async function _loadPool(showToast) {
        const pool = await HrPoolService.fetchPool();
        if (!pool) {
            const list = document.getElementById('hrPoolList');
            if (list) {
                list.innerHTML = '<p class="hr-pool-empty">Không tải được danh sách — kiểm tra server (cổng 5001).</p>';
            }
            if (showToast && typeof Helpers !== 'undefined' && Helpers.showToast) {
                Helpers.showToast('Không tải được danh sách.', 'error');
            }
            return;
        }

        _pool = (pool && pool.candidates) ? pool.candidates.slice() : [];
        _pool.sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0));
        _renderList();
        if (_selectedId) {
            const still = _pool.some(c => c.id === _selectedId);
            if (still) _selectCandidate(_selectedId);
            else _clearDetail();
        } else {
            _clearDetail();
        }
        if (showToast && typeof Helpers !== 'undefined' && Helpers.showToast) {
            Helpers.showToast('Đã cập nhật danh sách', 'success');
        }
    }

    function _renderList() {
        const list = document.getElementById('hrPoolList');
        if (!list) return;
        if (!_pool.length) {
            list.innerHTML = '<p class="hr-pool-empty">Chưa có ứng viên nào trong danh sách. Sau khi ứng viên chấm điểm xong, hồ sơ sẽ xuất hiện tại đây.</p>';
            return;
        }

        list.innerHTML = '';
        _pool.forEach(c => {
            const score = parseFloat(c.score);
            const ok = score >= 80;
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'hr-candidate-row ' + (ok ? 'hr-candidate-row--ok' : 'hr-candidate-row--bad');
            if (c.id === _selectedId) row.classList.add('hr-candidate-row--active');

            const name = document.createElement('div');
            name.className = 'hr-candidate-row__name';
            name.textContent = c.name || 'Ứng viên';

            const meta = document.createElement('div');
            meta.className = 'hr-candidate-row__meta';
            const badge = document.createElement('span');
            badge.className = 'hr-score-pill ' + (ok ? 'hr-score-pill--ok' : 'hr-score-pill--bad');
            badge.textContent = (isNaN(score) ? '—' : score.toFixed(1)) + ' điểm · ' + (ok ? 'Phù hợp' : 'Không phù hợp');
            meta.appendChild(badge);

            if (c.hrDecision) {
                const d = document.createElement('span');
                d.className = 'hr-decision-tag';
                d.textContent = c.hrDecision === 'pass' ? 'HR: Đậu' : 'HR: Rớt';
                meta.appendChild(d);
            }

            row.appendChild(name);
            row.appendChild(meta);
            row.addEventListener('click', () => _selectCandidate(c.id));
            list.appendChild(row);
        });
    }

    function _clearDetail() {
        _selectedId = null;
        const empty = document.getElementById('hrPoolDetailEmpty');
        const body = document.getElementById('hrPoolDetailBody');
        if (empty) empty.style.display = '';
        if (body) body.style.display = 'none';
    }

    function _renderHrAiSuggest(c) {
        const strengths = Array.isArray(c.aiStrengths) ? c.aiStrengths : [];
        const development = Array.isArray(c.aiDevelopment) ? c.aiDevelopment : [];
        const pending = document.getElementById('hrAiPendingMsg');
        const ulS = document.getElementById('hrDetailStrengths');
        const ulD = document.getElementById('hrDetailDevelopment');
        const recoEl = document.getElementById('hrDetailReco');
        const explWrap = document.getElementById('hrDetailExplanationWrap');
        const explSum = document.getElementById('hrDetailExplanationSummary');
        const explImp = document.getElementById('hrDetailExplanationImprovement');
        const hasLists = strengths.length > 0 || development.length > 0;
        const sumText = (c.aiAnalysisSummary && String(c.aiAnalysisSummary).trim()) || '';
        const impText = (c.aiAnalysisImprovement && String(c.aiAnalysisImprovement).trim()) || '';
        const hasExplanation = !!(sumText || impText);

        function fillUl(el, lines, emptyText) {
            if (!el) return;
            el.innerHTML = '';
            if (lines.length) {
                lines.forEach(function (line) {
                    const li = document.createElement('li');
                    li.textContent = typeof line === 'string' ? line : String(line || '');
                    el.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                li.className = 'hr-ai-empty';
                li.textContent = emptyText;
                el.appendChild(li);
            }
        }

        function renderExplanationBlock() {
            if (!explWrap || !explSum || !explImp) return;
            if (hasExplanation) {
                explWrap.style.display = '';
                explSum.textContent = sumText;
                if (impText) {
                    explImp.style.display = '';
                    explImp.textContent = impText;
                } else {
                    explImp.style.display = 'none';
                    explImp.textContent = '';
                }
            } else {
                explWrap.style.display = 'none';
                explSum.textContent = '';
                explImp.textContent = '';
            }
        }

        if (hasLists) {
            if (pending) pending.style.display = 'none';
            if (recoEl) {
                recoEl.style.display = 'none';
                recoEl.textContent = '';
            }
            fillUl(ulS, strengths, '—');
            fillUl(ulD, development, '—');
            renderExplanationBlock();
            return;
        }

        if (c.recommendation && String(c.recommendation).trim()) {
            if (pending) pending.style.display = 'none';
            if (ulS) ulS.innerHTML = '';
            if (ulD) ulD.innerHTML = '';
            if (recoEl) {
                recoEl.style.display = 'block';
                recoEl.textContent = c.recommendation;
            }
            renderExplanationBlock();
            return;
        }

        if (pending) pending.style.display = '';
        if (recoEl) {
            recoEl.style.display = 'none';
            recoEl.textContent = '';
        }
        fillUl(ulS, [], 'Chưa có — chờ phân tích AI hoàn tất.');
        fillUl(ulD, [], 'Chưa có — chờ phân tích AI hoàn tất.');
        renderExplanationBlock();
    }

    function _selectCandidate(id) {
        _selectedId = id;
        const c = _pool.find(x => x.id === id);
        const empty = document.getElementById('hrPoolDetailEmpty');
        const body = document.getElementById('hrPoolDetailBody');
        const note = document.getElementById('hrDetailDecisionNote');
        const fb = document.getElementById('hrFeedbackInput');
        if (!c || !body) return;
        if (empty) empty.style.display = 'none';
        body.style.display = '';

        document.getElementById('hrDetailName').textContent = c.name || '—';
        document.getElementById('hrDetailEmail').textContent = c.email ? ('Email: ' + c.email) : '—';

        const score = parseFloat(c.score);
        const ok = !isNaN(score) && score >= 80;
        const row = document.getElementById('hrDetailScoreRow');
        if (row) {
            row.innerHTML = '';
            const pill = document.createElement('span');
            pill.className = 'hr-detail-score ' + (ok ? 'hr-detail-score--ok' : 'hr-detail-score--bad');
            pill.textContent = (isNaN(score) ? '—' : score.toFixed(1)) + ' điểm — ' + (ok ? 'Phù hợp' : 'Không phù hợp');
            row.appendChild(pill);
        }

        _renderHrAiSuggest(c);
        if (fb) {
            fb.value = (c.hrFeedback != null && c.hrFeedback !== '') ? c.hrFeedback : '';
            fb.disabled = !!c.hrDecision;
        }

        const passBtn = document.getElementById('hrBtnPass');
        const failBtn = document.getElementById('hrBtnFail');
        if (c.hrDecision) {
            if (passBtn) passBtn.disabled = true;
            if (failBtn) failBtn.disabled = true;
            if (note) {
                note.style.display = '';
                note.textContent = c.hrDecision === 'pass'
                    ? 'Đã gửi quyết định: Đậu' + (c.notifiedAt ? ' (' + c.notifiedAt + ')' : '')
                    : 'Đã gửi quyết định: Rớt' + (c.notifiedAt ? ' (' + c.notifiedAt + ')' : '');
            }
        } else {
            if (passBtn) passBtn.disabled = false;
            if (failBtn) failBtn.disabled = false;
            if (note) note.style.display = 'none';
        }

        _renderList();
    }

    function _openDecisionModal(decision) {
        if (!_selectedId) return;
        const c = _pool.find(x => x.id === _selectedId);
        if (!c || c.hrDecision) return;

        _pendingDecision = decision;
        const modal = document.getElementById('hrDecisionModal');
        const title = document.getElementById('hrModalTitle');
        const text = document.getElementById('hrModalText');
        const fb = (document.getElementById('hrFeedbackInput') && document.getElementById('hrFeedbackInput').value) || '';

        const label = decision === 'pass' ? 'Đậu' : 'Rớt';
        if (title) title.textContent = 'Xác nhận: ' + label + ' — ' + (c.name || 'Ứng viên');
        if (text) {
            text.innerHTML = '';
            text.appendChild(document.createTextNode('Bạn chọn '));
            const strong = document.createElement('strong');
            strong.textContent = label;
            text.appendChild(strong);
            text.appendChild(document.createTextNode(' cho ứng viên này. Hệ thống sẽ ghi nhận feedback và gửi thông báo kết quả (demo).'));
            const br = document.createElement('br');
            const br2 = document.createElement('br');
            text.appendChild(br);
            text.appendChild(br2);
            if (fb.trim()) {
                text.appendChild(document.createTextNode('Feedback: '));
                const em = document.createElement('em');
                em.textContent = fb.trim();
                text.appendChild(em);
            }
        }
        if (modal) modal.style.display = 'flex';
    }

    function _closeModal() {
        const modal = document.getElementById('hrDecisionModal');
        if (modal) modal.style.display = 'none';
        _pendingDecision = null;
    }

    async function _confirmDecision() {
        if (!_pendingDecision || !_selectedId) {
            _closeModal();
            return;
        }
        const fbEl = document.getElementById('hrFeedbackInput');
        const feedback = fbEl ? fbEl.value.trim() : '';

        try {
            await HrPoolService.sendDecision(_selectedId, _pendingDecision, feedback);
            if (typeof Helpers !== 'undefined' && Helpers.showToast) {
                Helpers.showToast('Đã gửi thông báo kết quả tới ứng viên (demo).', 'success');
            }
            _closeModal();
            await _loadPool(false);
            _selectCandidate(_selectedId);
        } catch (e) {
            console.error(e);
            if (typeof Helpers !== 'undefined' && Helpers.showToast) {
                Helpers.showToast(e.message || 'Không gửi được — kiểm tra server.', 'error');
            } else {
                alert(e.message || 'Lỗi');
            }
        }
    }

    async function _handleFile(file) {
        if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
            alert('Chỉ chấp nhận file PDF');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('File không được vượt quá 10MB');
            return;
        }

        document.getElementById('jdUploadDropzone').style.display = 'none';
        document.getElementById('jdErrorCard').style.display = 'none';
        const proc = document.getElementById('jdProcessing');
        proc.style.display = 'flex';

        try {
            const formData = new FormData();
            formData.append('file', file);
            const resp = await fetch(Config.getApiUrl('/jd/upload'), { method: 'POST', body: formData });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || data.success === false) {
                throw new Error(data.message || `Server error: ${resp.status}`);
            }

            AppState.jdData = data.jd_data;
            AppState.jdRawText = data.rawText || '';
            proc.style.display = 'none';
            const preview = document.getElementById('jdPreview');
            preview.style.display = 'flex';
            document.getElementById('jdFileName').textContent = file.name;
            document.getElementById('jdFileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';

            _showResult(data.jd_data);
        } catch (err) {
            console.error('[ScreenHR] Upload error:', err);
            proc.style.display = 'none';
            document.getElementById('jdUploadDropzone').style.display = 'flex';
            _showError(err.message);
        }
    }

    async function _handleText() {
        const textarea = document.getElementById('jdTextarea');
        const text = (textarea?.value || '').trim();
        if (!text || text.length < 20) {
            alert('Vui lòng nhập nội dung JD (ít nhất 20 ký tự)');
            return;
        }

        document.getElementById('jdErrorCard').style.display = 'none';
        const proc = document.getElementById('jdTextProcessing');
        const btn = document.getElementById('jdTextSubmit');
        proc.style.display = 'flex';
        btn.disabled = true;

        try {
            const resp = await fetch(Config.getApiUrl('/jd/text'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || data.success === false) {
                throw new Error(data.message || `Server error: ${resp.status}`);
            }

            AppState.jdData = data.jd_data;
            AppState.jdRawText = text;
            proc.style.display = 'none';
            document.getElementById('jdTextDone').style.display = 'block';

            _showResult(data.jd_data);
        } catch (err) {
            console.error('[ScreenHR] Text extract error:', err);
            proc.style.display = 'none';
            btn.disabled = false;
            _showError(err.message);
        }
    }

    function _showError(msg) {
        const card = document.getElementById('jdErrorCard');
        const msgEl = document.getElementById('jdErrorMessage');
        if (!card || !msgEl) return;
        msgEl.textContent = msg
            ? ('⚠️ ' + msg)
            : '⚠️ File bạn tải lên không phải là nội dung JD. Vui lòng chọn đúng file mô tả công việc.';
        card.style.display = 'block';
    }

    function _showResult() {}

    function _resetUpload() {
        document.getElementById('jdPreview').style.display = 'none';
        document.getElementById('jdResultCard').style.display = 'none';
        document.getElementById('jdErrorCard').style.display = 'none';
        document.getElementById('jdUploadDropzone').style.display = 'flex';
        document.getElementById('jdFileInput').value = '';
        AppState.jdData = null;
        AppState.jdRawText = null;
    }

    function cleanup() {}

    return { init, cleanup };
})();
