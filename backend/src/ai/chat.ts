/**
 * AI 챗봇 엔드포인트 핸들러
 * AWS Bedrock Claude 3 Haiku를 사용하여 사용자 메시지를 분석하고
 * 적절한 아이템 타입을 추천합니다.
 * Requirements: 5.2, 5.3, 5.8, 5.9, 14.3
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getConfig, isTestEnv } from '../common/config';
import { getSupabaseClient } from '../db/client';

/** AI 챗봇 요청 */
export interface AIChatRequest {
  message: string;
}

/** AI 챗봇 응답 */
export interface AIChatResponse {
  reply: string;
  suggestedItemTypes: string[];
}

/** Bedrock 응답 파싱용 타입 */
interface BedrockTextContent {
  type: 'text';
  text: string;
}

interface BedrockResponse {
  content: BedrockTextContent[];
}

/** AI 챗봇 시스템 프롬프트 */
const AI_SYSTEM_PROMPT = `당신은 HARUMAN 대여 플랫폼의 AI 어시스턴트입니다.
사용자가 어떤 경험(콘서트, 여행, 캠핑, 졸업사진, 결혼식, 면접, 페스티벌 등)을 준비하는지 파악하고,
필요한 물품을 추천해주세요.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "reply": "사용자에게 보여줄 친절한 답변 메시지",
  "suggestedItemTypes": ["추천 아이템 타입 이름 배열"]
}

추천 가능한 아이템 타입 목록:
- 콘서트: 울트라 핸드폰, 대포카메라, 응원봉, 손풍기, 보조배터리, 쌍안경, 돗자리
- 졸업사진: 학사모, 졸업가운, 꽃다발, 정장, 구두
- 여행: 돼지코, 캐리어, 디카, 보조배터리, 고프로, 여행용 와이파이(에그)
- 캠핑: 텐트, 타프, 쉘터, 침구, 계절용품, 조리도구(화로, 코펠, 버너 등), 식기, 의자, 테이블, 가구, 타포(그늘막), 수레
- 결혼식: 하객룩, 구두, 넥타이
- 면접: 면접룩, 구두
- 페스티벌: 의상, 방수팩, 선글라스

suggestedItemTypes에는 위 목록에 있는 정확한 이름만 포함하세요.
존재하지 않는 아이템 타입은 절대 포함하지 마세요.`;

/**
 * 유효한 아이템 타입 목록 (DB에서 조회하거나 하드코딩)
 */
const VALID_ITEM_TYPES = new Set([
  '울트라 핸드폰', '대포카메라', '응원봉', '손풍기', '보조배터리', '쌍안경', '돗자리',
  '학사모', '졸업가운', '꽃다발', '정장', '구두',
  '돼지코', '캐리어', '디카', '고프로', '여행용 와이파이(에그)',
  '텐트', '타프', '쉘터', '침구', '계절용품', '조리도구(화로, 코펠, 버너 등)',
  '식기', '의자', '테이블', '가구', '타포(그늘막)', '수레',
  '하객룩', '넥타이',
  '면접룩',
  '의상', '방수팩', '선글라스',
]);

/**
 * 테스트 환경용 mock AI 챗봇
 */
function mockAIChat(message: string): AIChatResponse {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('콘서트') || lowerMsg.includes('공연')) {
    return {
      reply: '콘서트를 준비하시는군요! 필요한 물품을 추천해드릴게요.',
      suggestedItemTypes: ['울트라 핸드폰', '대포카메라', '응원봉', '보조배터리'],
    };
  }
  if (lowerMsg.includes('캠핑')) {
    return {
      reply: '캠핑 준비를 도와드릴게요!',
      suggestedItemTypes: ['텐트', '침구', '의자', '테이블'],
    };
  }
  if (lowerMsg.includes('여행')) {
    return {
      reply: '여행 준비물을 추천해드릴게요!',
      suggestedItemTypes: ['캐리어', '돼지코', '보조배터리', '고프로'],
    };
  }

  return {
    reply: '어떤 경험을 준비하고 계신가요? 콘서트, 여행, 캠핑, 졸업사진, 결혼식, 면접, 페스티벌 중 알려주시면 맞춤 추천을 해드릴게요!',
    suggestedItemTypes: [],
  };
}

/**
 * AI 챗봇 메시지 처리
 *
 * @param message - 사용자 메시지 (500자 이하)
 * @returns AI 응답 및 추천 아이템 타입 배열
 */
export async function processAIChat(message: string): Promise<AIChatResponse> {
  // 테스트 환경에서는 mock 사용
  if (isTestEnv()) {
    return mockAIChat(message);
  }

  const config = getConfig();
  const client = new BedrockRuntimeClient({ region: config.bedrockRegion });

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 500,
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    }),
  });

  // 10초 타임아웃, 재시도 없음 (Requirements: 5.8)
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI chatbot timeout')), 10000),
  );

  try {
    const response = await Promise.race([client.send(command), timeoutPromise]);
    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body),
    ) as BedrockResponse;

    const text = responseBody.content[0]?.text ?? '';
    // JSON 블록 추출
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('AI 응답 파싱 실패');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      reply?: string;
      suggestedItemTypes?: string[];
    };

    // 존재하지 않는 아이템 타입 필터링 (Requirements: 5.9)
    const validSuggestions = (parsed.suggestedItemTypes ?? []).filter(
      (item) => VALID_ITEM_TYPES.has(item),
    );

    return {
      reply: parsed.reply ?? 'AI 추천을 불러올 수 없습니다.',
      suggestedItemTypes: validSuggestions,
    };
  } catch (error) {
    // 타임아웃 또는 서비스 오류 시 기본 응답 (Requirements: 5.8)
    console.error('[AI Chat] 처리 실패:', error);
    return {
      reply: 'AI 추천을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
      suggestedItemTypes: [],
    };
  }
}
