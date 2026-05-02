(function () {
    // Quick questions (gợi ý câu hỏi)
    const QUICK_QUESTIONS = [
        'Cái này dùng để làm gì?',
        'Quy trình tuyển dụng thế nào?',
        'Cải thiện CV ra sao?',
        'Điểm của tôi là bao nhiêu?',
        'CV của tôi có điểm mạnh gì?'
    ];

    // ======================== KHỞI TẠO UI ========================
    function initChatbot() {
        const html = `
        <div id="cb-root">
            <div id="cb-button">💬</div>
            <div id="cb-tooltip" class="cb-tooltip-hidden">Trợ lý AI — bấm để hỏi về hệ thống hoặc kết quả phân tích CV.</div>
            <div id="cb-box" class="cb-hidden">
                <div id="cb-header">
                    <span>AI Career Coach</span>
                    <span id="cb-close">✕</span>
                </div>
                <div id="cb-messages"></div>
                <div id="cb-quick-questions" class="cb-quick-questions"></div>
                <div id="cb-input-wrap">
                    <input id="cb-input" placeholder="Nhắn gì đó..." />
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);

        const btn = document.getElementById("cb-button");
        const box = document.getElementById("cb-box");
        const close = document.getElementById("cb-close");
        const input = document.getElementById("cb-input");
        const messages = document.getElementById("cb-messages");
        const tooltip = document.getElementById("cb-tooltip");
        const quickContainer = document.getElementById("cb-quick-questions");

        // Tạo các nút quick question
        function renderQuickQuestions() {
            quickContainer.innerHTML = '';
            QUICK_QUESTIONS.forEach(q => {
                const btnQ = document.createElement('button');
                btnQ.className = 'cb-quick-btn';
                btnQ.innerText = q;
                btnQ.addEventListener('click', async () => {
                    // Gửi câu hỏi này như người dùng nhập
                    addMsg("user", q);
                    input.value = "";
                    showTyping();
                    try {
                        const reply = await getResponse(q);
                        hideTyping();
                        typeEffect(reply);
                    } catch (err) {
                        hideTyping();
                        addMsg("bot", "Oops, có lỗi xảy ra 😢");
                        console.error(err);
                    }
                });
                quickContainer.appendChild(btnQ);
            });
        }
        renderQuickQuestions();

        // Tooltip: tự hiện sau 1s, ẩn sau 5s hoặc khi mở chat
        let tooltipTimeout;
        function showTooltip() {
            tooltip.classList.remove('cb-tooltip-hidden');
            if (tooltipTimeout) clearTimeout(tooltipTimeout);
            tooltipTimeout = setTimeout(() => {
                tooltip.classList.add('cb-tooltip-hidden');
            }, 5000);
        }
        function hideTooltip() {
            tooltip.classList.add('cb-tooltip-hidden');
            if (tooltipTimeout) clearTimeout(tooltipTimeout);
        }

        btn.addEventListener("click", () => {
            box.classList.remove("cb-hidden");
            btn.style.display = "none";
            hideTooltip();
        });

        close.addEventListener("click", () => {
            box.classList.add("cb-hidden");
            btn.style.display = "flex";
            setTimeout(showTooltip, 2000);
        });

        setTimeout(showTooltip, 1000);

        // Xử lý gửi tin nhắn từ input (tránh tách từ cuối khi bộ gõ tiếng Việt / IME)
        let cbSending = false;
        input.addEventListener("keydown", async (e) => {
            if (e.key !== "Enter") return;
            // Enter trong lúc gõ Telex/VNI/Unikey — không gửi (tránh 2 bubble: thiếu từ cuối + "không" rời)
            if (e.isComposing || e.keyCode === 229) return;
            if (e.repeat) return;
            if (cbSending) return;

            const text = input.value.trim();
            if (!text) return;

            e.preventDefault();
            cbSending = true;
            addMsg("user", text);
            input.value = "";
            showTyping();

            try {
                const reply = await getResponse(text);
                hideTyping();
                typeEffect(reply);
            } catch (err) {
                hideTyping();
                addMsg("bot", "Oops, có lỗi xảy ra 😢");
                console.error(err);
            } finally {
                cbSending = false;
            }
        });

        function addMsg(type, text) {
            const div = document.createElement("div");
            div.className = `cb-msg ${type}`;
            div.innerText = text;
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
        }

        function showTyping() {
            const div = document.createElement("div");
            div.id = "cb-typing";
            div.className = "cb-msg bot";
            div.innerText = "Đang suy nghĩ...";
            messages.appendChild(div);
        }

        function hideTyping() {
            const t = document.getElementById("cb-typing");
            if (t) t.remove();
        }

        function typeEffect(text) {
            let i = 0;
            const div = document.createElement("div");
            div.className = "cb-msg bot";
            messages.appendChild(div);
            const speed = 10;
            const interval = setInterval(() => {
                if (i < text.length) {
                    div.innerText += text[i];
                    i++;
                    messages.scrollTop = messages.scrollHeight;
                } else {
                    clearInterval(interval);
                }
            }, speed);
        }

        addMsg('bot', 'Xin chào. Đây là AI Career Coach: bạn có thể hỏi ô chat này dùng để gì, hoặc sau khi phân tích CV — hỏi về điểm và gợi ý cải thiện.');

        // CSS
        const style = document.createElement("style");
        style.innerHTML = `
        #cb-root { position: fixed; bottom: 20px; right: 20px; z-index: 99999; font-family: Arial, sans-serif; }
        #cb-button { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#6c5ce7,#a29bfe); display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,0.25); transition:0.3s; position: relative; }
        #cb-button:hover { transform: scale(1.1); }
        #cb-tooltip { position: absolute; bottom: 70px; right: 0; background: white; color: #333; padding: 8px 12px; border-radius: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); font-size: 13px; white-space: nowrap; transition: 0.2s; border: 1px solid #e0e0e0; pointer-events: none; z-index: 99998; }
        #cb-tooltip::after { content: ''; position: absolute; bottom: -8px; right: 20px; border-width: 8px 8px 0; border-style: solid; border-color: white transparent transparent; }
        .cb-tooltip-hidden { opacity: 0; visibility: hidden; transform: translateY(10px); }
        #cb-box { width: 330px; height: 450px; background: white; border-radius: 18px; display:flex; flex-direction: column; overflow:hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        #cb-header { background: linear-gradient(135deg,#6c5ce7,#a29bfe); color:white; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; font-weight:bold; }
        #cb-close { cursor:pointer; }
        #cb-messages { flex:1; padding:12px; overflow-y:auto; background:#f1f2f6; }
        #cb-quick-questions { display: flex; gap: 8px; overflow-x: auto; padding: 8px 12px; background: white; border-top: 1px solid #eee; scrollbar-width: thin; }
        .cb-quick-btn { background: #f0f0f0; border: none; border-radius: 20px; padding: 6px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; transition: 0.2s; }
        .cb-quick-btn:hover { background: #e0e0e0; }
        #cb-input-wrap { padding: 8px 12px; border-top: 1px solid #eee; }
        #cb-input { width:100%; padding: 8px 12px; border-radius:20px; border:1px solid #ccc; outline:none; }
        .cb-msg { max-width:75%; padding:8px 12px; margin:6px 0; border-radius:12px; font-size:14px; line-height:1.5; white-space:pre-wrap; word-break:normal; overflow-wrap:break-word; }
        .user { background:#6c5ce7; color:white; margin-left:auto; border-bottom-right-radius:4px; }
        .bot { background:#e4e6eb; margin-right:auto; border-bottom-left-radius:4px; }
        .cb-hidden { display:none !important; }
        `;
        document.head.appendChild(style);
    }

    // ======================== XỬ LÝ TIN NHẮN (FAQ + intent — ChatController) ========================
    async function getResponse(message) {
        if (typeof ChatController !== 'undefined' && typeof ChatController.getResponse === 'function') {
            return await ChatController.getResponse(message);
        }
        return 'Hệ thống chưa tải xong trợ lý. Hãy tải lại trang.';
    }

    // Khởi chạy
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initChatbot);
    } else {
        initChatbot();
    }
})();