/**
 * Clean_Bot 채팅 메시지 필터 모듈
 * AWS Bedrock Claude 3 Haiku를 사용하여 욕설·비속어·외부 거래 유도를 감지합니다.
 * Requirements: 12.3, 12.4, 12.5, 13.1, 13.2, 13.3, 13.4
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getConfig, isTestEnv } from '../common/config';

/** Clean_Bot 판정 결과 */
export type CleanBotVerdict = 'clean' | 'warned' | 'failed';

/** Clean_Bot 분석 결과 */
export interface CleanBotResult {
  verdict: CleanBotVerdict;
  reason?: string;
}

/** Bedrock 응답 파싱용 타입 */
interface BedrockTextContent {
  type: 'text';
  text: string;
}

interface BedrockResponse {
  content: BedrockTextContent[];
}

/** Clean_Bot 판정 프롬프트 */
const CLEAN_BOT_PROMPT = `당신은 채팅 메시지 모더레이션 AI입니다.
아래 메시지를 분석하여 다음 중 하나를 판정하세요:
- "clean": 정상 메시지
- "warned": 욕설, 비속어, 외부 거래 유도(카카오톡 ID 공유, 직거래 유도, 계좌번호 요청 등) 포함

반드시 다음 JSON 형식으로만 응답하세요:
{"verdict": "clean" | "warned", "reason": "판정 이유 (warned인 경우만)"}

메시지:`;

/**
 * 테스트 환경용 mock Clean_Bot 분석
 * NODE_ENV=test 시 실제 Bedrock 호출 없이 mock 결과를 반환합니다.
 */
function mockAnalyzeMessage(content: string): CleanBotResult {
  // 테스트에서 jest.spyOn으로 오버라이드 가능
  const lowerContent = content.toLowerCase();
  const warningKeywords = ['욕설테스트', 'mock_warn', '시발', '씨발'];
  const isWarned = warningKeywords.some((kw) => lowerContent.includes(kw));
  return isWarned
    ? { verdict: 'warned', reason: 'mock: 비속어 감지' }
    : { verdict: 'clean' };
}

/**
 * AWS Bedrock Claude 3 Haiku를 사용하여 메시지를 분석합니다.
 * 5초 타임아웃 초과 시 'failed'를 반환하고 메시지 통과를 허용합니다.
 *
 * @param content - 분석할 채팅 메시지 내용
 * @returns Clean_Bot 판정 결과
 */
export async function analyzeMessage(content: string): Promise<CleanBotResult> {
  // 테스트 환경에서는 mock 사용
  if (isTestEnv()) {
    return mockAnalyzeMessage(content);
  }

  const config = getConfig();
  const client = new BedrockRuntimeClient({ region: config.bedrockRegion });

  const prompt = `${CLEAN_BOT_PROMPT}\n"${content}"`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  // 5초 타임아웃 적용
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Clean_Bot timeout')), 5000),
  );

  try {
    const response = await Promise.race([client.send(command), timeoutPromise]);
    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body),
    ) as BedrockResponse;

    const text = responseBody.content[0]?.text ?? '';
    // JSON 블록 추출 (마크다운 코드 블록 포함 대응)
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('Bedrock 응답 파싱 실패');
    }

    if (verdict === 'BANNED') {
      return { verdict: 'warned', reason: '비속어/욕설 감지' };
    }
    return { verdict: 'clean' };
  } catch (error) {
    // 타임아웃 또는 서비스 오류: 메시지 통과 허용 + 실패 로그 기록
    console.error('[Clean_Bot] 분석 실패, 메시지 통과 허용:', error);
    return { verdict: 'failed' };
  }
}
