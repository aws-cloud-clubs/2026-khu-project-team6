/**
 * AWS Bedrock Mock
 * NODE_ENV=test 시 실제 Bedrock 호출 대신 사전 정의된 응답을 반환합니다.
 * Requirements: 14.5
 */

/** AI 챗봇 응답 타입 */
export interface AIChatResponse {
  reply: string;
  suggestedItemTypes: string[];
}

/** Clean_Bot 분석 결과 타입 */
export interface CleanBotResult {
  isClean: boolean;
  reason?: string;
  confidence: number;
}

/** Mock 응답 시나리오 */
export type MockScenario = 'default' | 'concert' | 'camping' | 'graduation' | 'warning' | 'error';

/** 시나리오별 사전 정의 AI 챗봇 응답 */
const MOCK_CHAT_RESPONSES: Record<MockScenario, AIChatResponse> = {
  default: {
    reply: '안녕하세요! 어떤 물품이 필요하신가요? 행사나 목적을 알려주시면 맞춤 추천을 드릴게요.',
    suggestedItemTypes: [],
  },
  concert: {
    reply: '콘서트에 필요한 물품들을 추천해 드릴게요! 응원봉, 쌍안경, 보조배터리가 필수입니다.',
    suggestedItemTypes: ['응원봉', '쌍안경', '보조배터리', '손풍기'],
  },
  camping: {
    reply: '캠핑에 필요한 물품들을 추천해 드릴게요! 텐트, 침구, 조리도구가 기본입니다.',
    suggestedItemTypes: ['텐트', '침구', '조리도구(화로/코펠/버너)', '의자', '테이블'],
  },
  graduation: {
    reply: '졸업사진 촬영에 필요한 물품들을 추천해 드릴게요!',
    suggestedItemTypes: ['학사모', '졸업가운', '꽃다발'],
  },
  warning: {
    reply: '죄송합니다. 요청하신 내용을 처리할 수 없습니다.',
    suggestedItemTypes: [],
  },
  error: {
    reply: 'AI 추천을 불러올 수 없습니다. 직접 선택해 주세요.',
    suggestedItemTypes: [],
  },
};

/** 시나리오별 사전 정의 Clean_Bot 응답 */
const MOCK_CLEANBOT_RESPONSES: Record<string, CleanBotResult> = {
  clean: { isClean: true, confidence: 0.95 },
  abusive: { isClean: false, reason: '욕설 또는 비속어가 감지되었습니다.', confidence: 0.92 },
  solicitation: {
    isClean: false,
    reason: '외부 거래 유도 내용이 감지되었습니다.',
    confidence: 0.88,
  },
};

/**
 * Mock AI 챗봇 응답 생성
 * 메시지 내용에 따라 적절한 시나리오를 선택합니다.
 */
export async function mockInvokeAIChatbot(message: string): Promise<AIChatResponse> {
  console.info('[BEDROCK MOCK] AI 챗봇 호출 시뮬레이션:', {
    message: message.slice(0, 100),
    timestamp: new Date().toISOString(),
  });

  // 메시지 내용에 따라 시나리오 선택
  const lowerMessage = message.toLowerCase();
  let scenario: MockScenario = 'default';

  if (lowerMessage.includes('콘서트') || lowerMessage.includes('공연')) {
    scenario = 'concert';
  } else if (lowerMessage.includes('캠핑') || lowerMessage.includes('야영')) {
    scenario = 'camping';
  } else if (lowerMessage.includes('졸업') || lowerMessage.includes('학사')) {
    scenario = 'graduation';
  }

  // 실제 Bedrock 호출 지연 시뮬레이션 (테스트에서는 즉시 반환)
  return MOCK_CHAT_RESPONSES[scenario];
}

/**
 * Mock Clean_Bot 메시지 분석
 * 메시지 내용에 따라 적절한 분석 결과를 반환합니다.
 */
export async function mockAnalyzeMessage(message: string): Promise<CleanBotResult> {
  console.info('[BEDROCK MOCK] Clean_Bot 분석 시뮬레이션:', {
    messageLength: message.length,
    timestamp: new Date().toISOString(),
  });

  // 테스트용 키워드 기반 판정
  const abusiveKeywords = ['욕설테스트', '비속어테스트'];
  const solicitationKeywords = ['외부거래테스트', '카카오톡으로'];

  if (abusiveKeywords.some((kw) => message.includes(kw))) {
    return MOCK_CLEANBOT_RESPONSES['abusive'];
  }

  if (solicitationKeywords.some((kw) => message.includes(kw))) {
    return MOCK_CLEANBOT_RESPONSES['solicitation'];
  }

  return MOCK_CLEANBOT_RESPONSES['clean'];
}

/**
 * Mock Bedrock 타임아웃 시뮬레이션
 * 테스트에서 타임아웃 시나리오를 검증할 때 사용합니다.
 */
export async function mockBedrockTimeout(): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Bedrock request timed out after 10000ms'));
    }, 10001);
  });
}
