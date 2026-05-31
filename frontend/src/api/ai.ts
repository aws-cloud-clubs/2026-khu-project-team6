/**
 * AI 챗봇 API 함수
 * Requirements: 5.x, 14.x
 */

import apiClient from './client';

export interface AIChatRequest {
  message: string;
}

export interface AIChatResponse {
  reply: string;
  /** 체크박스 자동 선택용 아이템 타입 이름 배열 */
  suggestedItemTypes: string[];
}

/**
 * AI 챗봇 메시지 전송
 * 메시지는 500자 이하여야 합니다.
 */
export async function sendAIChat(message: string): Promise<AIChatResponse> {
  const res = await apiClient.post<AIChatResponse>('/ai/chat', { message });
  return res.data;
}
