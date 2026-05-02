/** FAQ rule-based — khớp keyword đầu tiên (đặt mục cụ thể trước mục rộng). */
const FAQ_DATA = [
    {
        keywords: [
            'cái này dùng',
            'cái này để',
            'dùng làm gì',
            'chatbot này',
            'ô chat',
            'cửa sổ chat',
            'ứng dụng này',
            'hệ thống này',
            'ai career coach',
            'career coach',
            'mục đích',
            'chức năng',
            'cách dùng',
            'làm sao dùng',
            'hướng dẫn sử dụng',
            'bot này',
            'con chatbot'
        ],
        answer:
            'Đây là ô trò chuyện AI Career Coach trên hệ thống tuyển dụng.\n\n' +
            'Bạn có thể hỏi các chủ đề đã được soạn sẵn (quy trình, quyền riêng tư, ai quyết định…) hoặc hỏi về điểm số và gợi ý cải thiện CV sau khi đã chạy phân tích — phần đó hệ thống dùng kết quả phân tích thực tế của bạn để trả lời.'
    },
    {
        keywords: [
            'ai xem cv',
            'cv có ai xem',
            'có ai đọc cv',
            'ai duyệt cv',
            'hr xem cv',
            'hr có xem',
            'hr đọc cv'
        ],
        answer:
            'Bạn tải CV lên hệ thống AI CV Screening; hệ thống trích thông tin để bạn kiểm tra lại cho khớp với file. ' +
            'Sau đó AI đánh giá mức phù hợp với JD và các yêu cầu nội bộ (chi tiết tiêu chí không công bố cho ứng viên). ' +
            'Phía HR sẽ rà soát thêm; kết quả/ phản hồi chính thức thường gửi qua email trong khoảng 2–3 ngày.'
    },
    {
        keywords: ['hr quyết định', 'ai quyết định', 'quyết định cuối cùng', 'ai chọn ứng viên'],
        answer:
            'AI hỗ trợ đánh giá sơ bộ. HR (và vòng phỏng vấn / quản lý tuyển dụng) tham gia ở các bước sau. ' +
            'Quyết định tuyển dụng cuối cùng không chỉ dựa trên một điểm số tự động.'
    },
    {
        keywords: ['quy trình tuyển dụng', 'process tuyển dụng', 'flow tuyển dụng', 'tuyển dụng thế nào', 'quy trình ứng tuyển'],
        answer:
            'Quy trình: nộp CV lên hệ thống AI CV Screening → bạn kiểm tra lại thông tin trích từ CV so với bản gốc → ' +
            'AI đánh giá phù hợp CV với JD và yêu cầu nội bộ (không công bố chi tiết tiêu chí) → hệ thống trả điểm mạnh, điểm yếu, hướng cải thiện → ' +
            'HR rà soát; phản hồi chính thức thường qua email trong khoảng 2–3 ngày. ' +
            'Phân tích trình bày trực quan, minh bạch; hướng tới không phân biệt và không thiên kiến thuật toán.'
    },
    {
        keywords: ['bao lâu', 'khi nào có kết quả', 'bao giờ có kết quả', 'mấy ngày có mail', 'email khi nào'],
        answer:
            'Sau bước phân tích trên hệ thống, HR rà soát thêm. ' +
            'Phản hồi/kết quả chính thức thường được gửi qua email trong khoảng 2–3 ngày (có thể thay đổi theo từng đợt; theo dõi email và thông báo từ nhà tuyển dụng).'
    },
    {
        keywords: ['bảo mật', 'cv có bị lộ', 'dữ liệu cá nhân', 'an toàn không'],
        answer:
            'CV và dữ liệu bạn cung cấp được dùng trong phạm vi hồ sơ ứng tuyển và phân tích phù hợp. ' +
            'Hãy không chia sẻ mật khẩu hoặc thông tin nhạy cảm qua kênh không chính thức.'
    },
    {
        keywords: ['ai có công bằng không', 'ai có thiên vị không', 'thiên kiến thuật toán', 'minh bạch'],
        answer:
            'Hệ thống trình bày đánh giá trực quan, minh bạch; thiết kế hướng tới không phân biệt và không thiên kiến thuật toán. ' +
            'Quyết định tuyển chọn cuối cùng vẫn thuộc HR và quy trình tổ chức sau bước rà soát.'
    },
    {
        keywords: ['liên hệ', 'khiếu nại'],
        answer:
            'Bạn dùng kênh liên hệ hoặc email hỗ trợ do ban tổ chức / nhà tuyển dụng công bố trên trang tuyển dụng.'
    },
    {
        keywords: ['feedback kết quả', 'phản ánh kết quả', 'góp ý kết quả'],
        answer:
            'Bạn có thể gửi góp ý qua kênh chính thức của chương trình tuyển dụng hoặc bộ phận HR được ghi trên thông báo.'
    },
    {
        keywords: [
            'khả năng đậu',
            'tỷ lệ đậu',
            'có đậu không',
            'đậu ko',
            'bao nhiêu % đậu',
            'phần trăm đậu',
            'khả năng trúng tuyển',
            'liệu có đậu'
        ],
        answer:
            'Không thể khẳng định trước là bạn có được nhận hay không: quyết định phụ thuộc HR, lịch phỏng vấn và tiêu chí tổ chức. ' +
            'Điểm phù hợp trên hệ thống chỉ là tham khảo so với JD, không thay thế toàn bộ quy trình tuyển dụng.'
    }
];
