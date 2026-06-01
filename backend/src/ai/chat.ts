/**
 * AI 챗봇 핸들러 — AWS Bedrock Nova Lite (서울 리전)
 * Requirements: 5.2, 5.3, 5.8, 5.9, 14.3
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { isTestEnv } from '../common/config';

/** AI 챗봇 응답 */
export interface AIChatResponse {
  reply: string;
  suggestedItemTypes: string[];
}

/** Nova 응답 구조 */
interface NovaResponse {
  output?: {
    message?: {
      content?: Array<{ text?: string }>;
    };
  };
}

/** 시스템 프롬프트 */
const SYSTEM_PROMPT = `너는 HARUMAN 대여 플랫폼 추천AI다. 반드시 아래 JSON만 출력해.
{"reply":"한줄답변","suggestedItemTypes":["물품1","물품2"]}
추천 가능 목록만 사용: 텐트,타프,쉘터,침구,의자,테이블,수레,캐리어,돼지코,디카,고프로,보조배터리,여행용 와이파이(에그),응원봉,대포카메라,쌍안경,손풍기,돗자리,울트라 핸드폰,학사모,졸업가운,꽃다발,정장,구두,하객룩,넥타이,면접룩,의상,방수팩,선글라스
목록에 없는 아이템은 절대 포함하지 마. JSON 외 텍스트 출력 금지.`;

/** 유효 아이템 타입 */
const VALID_ITEM_TYPES = new Set([
  '울트라 핸드폰', '대포카메라', '응원봉', '손풍기', '보조배터리', '쌍안경', '돗자리',
  '학사모', '졸업가운', '꽃다발', '정장', '구두',
  '돼지코', '캐리어', '디카', '고프로', '여행용 와이파이(에그)',
  '텐트', '타프', '쉘터', '침구', '계절용품', '조리도구(화로 코펠 버너 등)',
  '식기', '의자', '테이블', '가구', '타포(그늘막)', '수레',
  '하객룩', '넥타이', '면접룩', '의상', '방수팩', '선글라스',
]);

/** 테스트 mock */
function mockAIChat(message: string): AIChatResponse {
  const lower = message.toLowerCase();
  if (lower.includes('콘서트') || lower.includes('공연')) {
    return { reply: '콘서트 준비물 추천!', suggestedItemTypes: ['응원봉', '보조배터리', '쌍안경'] };
  }
  if (lower.includes('캠핑')) {
    return { reply: '캠핑 준비물 추천!', suggestedItemTypes: ['텐트', '침구', '의자'] };
  }
  if (lower.includes('여행')) {
    return { reply: '여행 준비물 추천!', suggestedItemTypes: ['캐리어', '돼지코', '고프로'] };
  }
  return { reply: '어떤 경험을 준비하시나요?', suggestedItemTypes: [] };
}

/**
 * AI 챗봇 — Nova Lite (ap-northeast-2)
 * maxTokens: 50, temperature: 0.1
 */
export async function processAIChat(message: string): Promise<AIChatResponse> {
  if (isTestEnv()) return mockAIChat(message);

  const client = new BedrockRuntimeClient({ region: 'ap-northeast-2' });

  const command = new InvokeModelCommand({
    modelId: 'eu.amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      messages: [{ role: 'user', content: [{ text: message }] }],
      system: [{ text: SYSTEM_PROMPT }],
      inferenceConfig: { maxTokens: 50, temperature: 0.1 },
    }),
  });

  // 10초 타임아웃
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI timeout')), 10000),
  );

  try {
    const response = await Promise.race([client.send(command), timeout]);
    const body = JSON.parse(
      Buffer.from(response.body as Uint8Array).toString(),
    ) as NovaResponse;

    const text = body?.output?.message?.content?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('파싱 실패');

    const parsed = JSON.parse(jsonMatch[0]) as {
      reply?: string;
      suggestedItemTypes?: string[];
    };

    const validSuggestions = (parsed.suggestedItemTypes ?? []).filter(
      (item) => VALID_ITEM_TYPES.has(item),
    );

    return {
      reply: parsed.reply ?? '추천 결과입니다.',
      suggestedItemTypes: validSuggestions,
    };
  } catch (error) {
    console.error('[AI Chat] Nova Lite 오류:', error);
    return { reply: 'AI 추천을 불러올 수 없습니다.', suggestedItemTypes: [] };
  }
}
