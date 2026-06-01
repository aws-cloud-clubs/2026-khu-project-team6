/**
 * Clean_Bot 채팅 메시지 필터 모듈
 * AWS Bedrock Nova Lite (서울 리전)를 사용하여 욕설·비속어·외부 거래 유도를 감지합니다.
 * Requirements: 12.3, 12.4, 12.5, 13.1, 13.2, 13.3, 13.4
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { isTestEnv } from '../common/config';

/** Clean_Bot 판정 결과 */
export type CleanBotVerdict = 'clean' | 'warned' | 'failed';

/** Clean_Bot 분석 결과 */
export interface CleanBotResult {
  verdict: CleanBotVerdict;
  reason?: string;
}

/** Nova 응답 구조 */
interface NovaResponse {
  output?: {
    message?: {
      content?: Array<{ text?: string }>;
    };
  };
}

/** Clean_Bot 시스템 프롬프트 */
const CLEANBOT_SYSTEM = `너는 채팅 메시지 모더레이션 AI다.
메시지를 분석해 다음 중 하나를 판정해.
- "clean": 정상
- "warned": 욕설, 비속어, 외부 거래 유도(카카오톡 ID, 직거래 유도, 계좌번호 요청 등) 포함

반드시 JSON만 출력: {"verdict":"clean","reason":""}
warned일 때만 reason에 이유를 적어.`;

/**
 * 테스트 환경용 mock
 */
function mockAnalyzeMessage(content: string): CleanBotResult {
  const lowerContent = content.toLowerCase();
  const warningKeywords = ['욕설테스트', '외부거래테스트', 'mock_warn'];
  const isWarned = warningKeywords.some((kw) => lowerContent.includes(kw));
  return isWarned
    ? { verdict: 'warned', reason: 'mock: 경고 키워드 감지' }
    : { verdict: 'clean' };
}

/**
 * AWS Bedrock Nova Lite로 메시지를 분석합니다.
 * 5초 타임아웃 초과 시 'failed'를 반환하고 메시지 통과를 허용합니다.
 */
export async function analyzeMessage(content: string): Promise<CleanBotResult> {
  if (isTestEnv()) {
    return mockAnalyzeMessage(content);
  }

  const client = new BedrockRuntimeClient({ region: 'us-east-1' });

  const command = new InvokeModelCommand({
    modelId: 'us.amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      messages: [
        { role: 'user', content: [{ text: `다음 메시지를 검열해: "${content}"` }] },
      ],
      system: [{ text: CLEANBOT_SYSTEM }],
      inferenceConfig: { maxTokens: 50, temperature: 0.1 },
    }),
  });

  // 5초 타임아웃
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Clean_Bot timeout')), 5000),
  );

  try {
    const response = await Promise.race([client.send(command), timeoutPromise]);
    const body = JSON.parse(
      Buffer.from(response.body as Uint8Array).toString(),
    ) as NovaResponse;

    const text = body?.output?.message?.content?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('Nova 응답 파싱 실패');

    const parsed = JSON.parse(jsonMatch[0]) as { verdict: string; reason?: string };
    const verdict = parsed.verdict === 'warned' ? 'warned' : 'clean';
    return { verdict, reason: parsed.reason };
  } catch (error) {
    console.error('[Clean_Bot] Nova Lite 분석 실패, 메시지 통과 허용:', error);
    return { verdict: 'failed' };
  }
}
