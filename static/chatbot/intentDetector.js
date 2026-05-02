const IntentDetector = {
    detect(message) {
        const msg = message.toLowerCase().trim();

        if (
            msg.includes('đậu') ||
            msg.includes('pass') ||
            msg.includes('rớt') ||
            msg.includes('fail') ||
            msg.includes('bao nhiêu %') ||
            msg.includes('score') ||
            msg.includes('điểm bao nhiêu') ||
            msg.includes('điểm của tôi') ||
            msg.includes('điểm tôi') ||
            msg.includes('điểm số') ||
            msg.includes('match') ||
            msg.includes('phù hợp bao nhiêu')
        ) return 'SCORE';

        if (
            msg.includes('điểm mạnh') ||
            msg.includes('điểm yếu') ||
            msg.includes('cv tôi') ||
            msg.includes('cv của tôi') ||
            msg.includes('cv ổn không') ||
            msg.includes('tôi có gì') ||
            msg.includes('tôi thiếu gì') ||
            msg.includes('cần cải thiện') ||
            msg.includes('phân tích cv') ||
            msg.includes('làm sao để cải thiện') ||
            msg.includes('cải thiện cv') ||
            msg.includes('tăng điểm')
        ) return 'SELF_ANALYSIS';

        // Bước tiếp / làm gì trước (không rule hết câu — chỉ nhóm intent)
        if (
            msg.includes('phải làm gì') ||
            msg.includes('phải làm sao') ||
            msg.includes('làm gì trước') ||
            msg.includes('làm gì đầu') ||
            msg.includes('làm gì bây giờ') ||
            msg.includes('làm gì đây') ||
            msg.includes('đầu tiên') ||
            msg.includes('bắt đầu') ||
            msg.includes('tiếp theo') ||
            msg.includes('next step') ||
            msg.includes('what should i') ||
            msg.includes('giờ làm') ||
            msg.includes('bước tiếp') ||
            msg.includes('làm gì tiếp') ||
            msg.includes('nên làm gì') ||
            msg.includes('tôi làm gì') ||
            msg.includes('mình làm gì')
        ) return 'NEXT_STEP';

        if (
            msg.includes('công ty') ||
            msg.includes('job') ||
            msg.includes('vị trí') ||
            msg.includes('tuyển dụng') ||
            msg.includes('mô tả công việc') ||
            msg.includes('jd ') ||
            msg.includes('jd,')
        ) return 'JOB_INFO';

        if (
            msg.includes('phản ánh') ||
            msg.includes('feedback') ||
            msg.includes('khiếu nại') ||
            msg.includes('report result') ||
            msg.includes('review result') ||
            msg.includes('góp ý')
        ) return 'FEEDBACK';

        return 'UNKNOWN';
    }
};
