# Hệ thống tuyển dụng AI

Ứng dụng web hỗ trợ **HR** nhập JD và quản lý ứng viên; **ứng viên** nộp CV (PDF), chỉnh thông tin trích xuất, nhận đánh giá phù hợp (XGBoost, khớp kỹ năng với JD, giải thích SHAP); có **khảo sát** và **chatbot AI Career Coach**.

---

## Mục đích nộp mã nguồn và bản demo

- **Mã nguồn trong repository** phục vụ **ban tổ chức / hội đồng kiểm tra** (cấu trúc project, luồng xử lý, backend).
- **Chạy thử giao diện đầy đủ** được thể hiện trong **video demo** đã nộp kèm theo quy định của cuộc thi / đồ án.

---

## Bảo mật: không có API key trong repository

**Trong repo không chứa khóa API** (Anthropic hoặc bất kỳ secret nào) vì lý do **bảo mật** và **tránh lộ key** khi public / fork / push lên Git (các dịch vụ như GitHub cũng có thể quét và chặn secret trong code).

Sau khi clone về máy, bạn **tự dán API key** vào biến **`_DEFAULT_ANTHROPIC_KEY`** trong file **`AiB3_The-Greenlighters/server.py`**.

---

## Cấu trúc thư mục

Mô tả ngắn gọn theo **thư mục**; file bên trong chỉ liệt kê tên. Thư mục **`output/`** thường chưa có khi mới clone — server tạo khi chạy.

```
AiB3_The-Greenlighters/
├── README.md
├── requirements.txt
├── .gitignore
├── index.html
├── app.js
├── server.py
├── styles.css
├── config/                            # Cấu hình frontend (URL, cổng API)
│   └── config.js
├── components/                        # Giao diện
│   ├── Screen0_Landing.js
│   ├── Screen1_Transparency.js
│   ├── Screen2_CVPreview.js
│   ├── Screen3_Processing.js
│   ├── Screen4_Results.js
│   ├── Screen5_Survey.js
│   └── ScreenHR_JDUpload.js
├── data/                           
│   ├── database.js
│   └── mockData.js
├── model/                             # Mô hình XGBoost đã train 
│   ├── xgb_model.pkl
│   └── Modelxgb.py
├── preprocess/                        # Artefact tiền xử lý học máy: vectorizer, đặc trưng, mẫu dữ liệu, script pipeline
│   ├── tfidf_vectorizer.pkl
│   ├── feature_names_full.pkl
│   ├── feature_names_fair.pkl
│   ├── X_processed_full.npz
│   ├── y_processed_full.npy
│   ├── dataset1_.csv
│   └── dataset 1 ana.py
├── services/                          # Lớp gọi API backend: phân tích CV, pool HR, PDF, HTTP chung
│   ├── apiService.js
│   ├── cvAnalysisService.js
│   ├── hrPoolService.js
│   └── pdfService.js
├── utils/                             # Hàm tiện ích dùng chung
│   └── helpers.js
└── output/                            # Dữ liệu runtime: CV/JD đã tải, khảo sát, pool HR 
    ├── CV/
    ├── JD/
    ├── Survey/
    └── hr_pool/
```

---

## Cài đặt và chạy (local)

### 1. Cài thư viện Python

Trong thư mục có file **`requirements.txt`**, chạy:

```bash
pip install -r requirements.txt
```

*(Nếu lỗi, thử `pip3` hoặc `py -m pip install -r requirements.txt`.)*

### 2. API key Anthropic (chạy AI)

Mở **`AiB3_The-Greenlighters/server.py`**, tìm **`_DEFAULT_ANTHROPIC_KEY`**, dán key của bạn vào chuỗi rồi lưu.

### 3. Chạy backend và mở giao diện

Từ thư mục gốc project (chứa cả thư mục `AiB3_The-Greenlighters`), chạy:

```bash
python3 AiB3_The-Greenlighters/server.py
```

Sau đó mở **`AiB3_The-Greenlighters/index.html`**.

---

## Lỗi thường gặp

| Hiện tượng | Gợi ý |
|------------|--------|
| Thiếu module Python | Cài lại `pip install -r requirements.txt`; kiểm tra đúng Python 3.9+. |
| Chat / trích CV báo thiếu key | Đã dán key vào `_DEFAULT_ANTHROPIC_KEY` trong `AiB3_The-Greenlighters/server.py` chưa; khởi động lại server. |
| Port **5001** bị chiếm | Tắt process khác hoặc đổi port trong `server.py` và `config/config.js` cho khớp. |
| Không thấy kết quả | Đảm bảo đã chạy backend; tải lại trang. |
