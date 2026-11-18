// api/generate.js
export default async function handler(req, res) {
  // CORS 처리 (필요 시)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST 요청만 허용됩니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: '서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel 설정에서 환경변수를 추가해주세요.'
    });
  }

  try {
    const { type, text, imageBase64, mimeType } = req.body;

    let systemPrompt = '';
    if (type === 'appointment') {
      systemPrompt = `
당신은 한국 병원 예약 문자/카톡 및 예약증 분석 AI '우병수(우리병원수첩)'입니다.
입력된 텍스트나 이미지를 분석하여 반드시 아래 JSON 형식으로만 응답하세요. (마크다운 코드블록 없이 순수 JSON만 출력)
{
  "hospitalName": "병원명 (예: 서울아산병원 내과)",
  "department": "진료과 (없으면 '일반진료')",
  "date": "YYYY-MM-DD 형식의 예약일 (연도가 없으면 2026년 기준 추정)",
  "time": "HH:MM 형식의 예약시간",
  "notes": "준비물, 금식 여부, 주의사항 등 요약",
  "reminderTip": "예약 2~3일 전 알림 메시지 예시"
}`;
    } else if (type === 'prescription') {
      systemPrompt = `
당신은 한국 처방전 및 약봉투 분석 AI '우병수(우리병원수첩)'입니다.
입력된 처방전/약봉투 이미지나 텍스트를 분석하여 반드시 아래 JSON 형식으로만 응답하세요. (마크다운 코드블록 없이 순수 JSON만 출력)
{
  "hospitalName": "처방 병원 또는 약국명",
  "durationDays": 3,
  "medications": [
    {
      "name": "약 이름",
      "effect": "간단한 효능 (예: 소염진통제, 위장보호제)",
      "timing": "복용 시간대 (예: 아침·점심·저녁 식후 30분)",
      "dosage": "1회 복용량 (예: 1정)"
    }
  ],
  "precautions": "복약 시 주의사항 (예: 졸음 유발 가능, 음주 금지 등)"
}`;
    } else if (type === 'insurance') {
      systemPrompt = `
당신은 한국 실손의료보험 청구 도우미 AI '우병수(우리병원수첩)'입니다.
입력된 진료비 영수증/세부내역서 이미지나 진료 내용을 분석하여 반드시 아래 JSON 형식으로만 응답하세요. (마크다운 코드블록 없이 순수 JSON만 출력)
{
  "hospitalName": "병원명",
  "treatmentDate": "진료일자",
  "totalPaid": 25000,
  "eligible": true,
  "eligibilityReason": "실손보험 청구 가능 여부 및 사유 (급여/비급여 항목 및 공제금액 안내)",
  "estimatedRefund": 15000,
  "requiredDocs": ["진료비 영수증", "진료비 세부내역서", "처방전(약제비 청구 시)"],
  "silson24Guide": "실손24 앱/웹을 통한 비대면 간편 청구 단계별 안내 요약"
}`;
    } else {
      return res.status(400).json({ error: '유효하지 않은 요청 타입(type)입니다.' });
    }

    const parts = [{ text: systemPrompt }];
    if (text) {
      parts.push({ text: `\n[사용자 입력 데이터]\n${text}` });
    }
    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
  { ... }
);
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Gemini API 호출 실패');
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedResult = JSON.parse(rawText);

    return res.status(200).json({ success: true, data: parsedResult });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'AI 분석 중 오류가 발생했습니다.'
    });
  }
}
