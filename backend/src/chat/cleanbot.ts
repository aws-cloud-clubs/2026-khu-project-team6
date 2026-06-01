/**
 * Clean_Bot 채팅 메시지 필터 모듈
 * AWS Bedrock Nova Lite를 사용하여 오직 비속어·욕설만 필터링합니다.
 * 장외거래 유도는 시스템 버튼으로 제어하므로 AI 검열 대상에서 제외.
 * modelId: arn:aws:bedrock:ap-northeast-2::inference-profile/amazon.nova-lite-v1:0
 * maxTokens: 5, temperature: 0.0 → BANNED 또는 PASSED만 반환
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

/**
 * 테스트 환경용 mock
 */
function mockAnalyzeMessage(content: string): CleanBotResult {
  const lowerContent = content.toLowerCase();
  const warningKeywords = ['욕설테스트', 'mock_warn', '시발', '씨발'];
  const isWarned = warningKeywords.some((kw) => lowerContent.includes(kw));
  return isWarned
    ? { verdict: 'warned', reason: 'mock: 비속어 감지' }
    : { verdict: 'clean' };
}

/**
 * AWS Bedrock Nova Lite로 메시지를 분석합니다.
 * 오직 비속어·욕설만 필터링. BANNED 또는 PASSED만 반환받음.
 * 5초 타임아웃 초과 시 'failed'를 반환하고 메시지 통과를 허용합니다.
 */
export async function analyzeMessage(content: string): Promise<CleanBotResult> {
  if (isTestEnv()) {
    return mockAnalyzeMessage(content);
  }

  const client = new BedrockRuntimeClient({
    region: 'ap-northeast-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });

  const command = new InvokeModelCommand({
    modelId: 'arn:aws:bedrock:ap-northeast-2::inference-profile/amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      messages: [
        { role: 'user', content: [{ text: content }] },
      ],
      system: [{ text: '비속어·욕설이 포함되면 BANNED, 아니면 PASSED 한 단어만 출력.' }],
      inferenceConfig: { maxTokens: 5, temperature: 0.0 },
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

    const rawText = body?.output?.message?.content?.[0]?.text ?? '';
    // 공백·개행 제거 후 판정
    const verdict = rawText.trim().toUpperCase();

    if (verdict === 'BANNED') {
      return { verdict: 'warned', reason: '비속어/욕설 감지' };
    }
    return { verdict: 'clean' };
  } catch (error) {
    console.error('[Clean_Bot] Nova Lite 분석 실패, 메시지 통과 허용:', error);
    return { verdict: 'failed' };
  }
}
