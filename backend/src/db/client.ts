/**
 * Supabase 클라이언트 싱글턴 모듈
 * NODE_ENV=test 시 mock 클라이언트를 반환합니다.
 * Requirements: 14.5
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig, isTestEnv } from '../common/config';

/** Supabase 클라이언트 타입 재내보내기 */
export type { SupabaseClient };

/** 테스트용 mock Supabase 클라이언트 */
function createMockSupabaseClient(): SupabaseClient {
  // 테스트 환경에서는 실제 Supabase 연결 없이 mock 객체 반환
  // 각 테스트에서 jest.spyOn 또는 jest.mock으로 필요한 메서드를 모킹합니다.
  const mockClient = createClient(
    'http://localhost:54321',
    'mock-service-key-for-testing-only',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return mockClient;
}

/** 싱글턴 클라이언트 인스턴스 */
let _supabaseClient: SupabaseClient | null = null;

/**
 * Supabase 클라이언트 싱글턴을 반환합니다.
 * - 테스트 환경(NODE_ENV=test): mock 클라이언트 반환
 * - 그 외 환경: 실제 Supabase 클라이언트 반환
 *
 * Lambda 콜드 스타트 시 한 번만 초기화되어 재사용됩니다.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_supabaseClient) {
    return _supabaseClient;
  }

  if (isTestEnv()) {
    _supabaseClient = createMockSupabaseClient();
    return _supabaseClient;
  }

  const config = getConfig();
  _supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });

  return _supabaseClient;
}

/**
 * 테스트에서 클라이언트 캐시를 초기화합니다.
 * @internal 테스트 전용
 */
export function resetSupabaseClient(): void {
  _supabaseClient = null;
}

/** 기본 내보내기: 싱글턴 getter */
export default getSupabaseClient;
