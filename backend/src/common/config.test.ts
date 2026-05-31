/**
 * 환경변수 로더 단위 테스트
 */

import { loadConfig, isTestEnv, isProductionEnv, resetConfigCache } from './config';

describe('loadConfig', () => {
  beforeEach(() => {
    resetConfigCache();
  });

  it('테스트 환경에서 환경변수를 올바르게 로드해야 한다', () => {
    // jest.setup.js에서 설정된 환경변수 사용
    const config = loadConfig();

    expect(config.nodeEnv).toBe('test');
    expect(config.supabaseUrl).toBe('http://localhost:54321');
    expect(config.jwtSecret).toBeTruthy();
    expect(config.sesFromEmail).toBeTruthy();
    expect(config.bedrockRegion).toBe('ap-northeast-2');
    expect(config.s3Bucket).toBeTruthy();
  });

  it('필수 환경변수가 없으면 오류를 던져야 한다', () => {
    const originalUrl = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_URL;

    expect(() => loadConfig()).toThrow("필수 환경변수 'SUPABASE_URL'가 설정되지 않았습니다.");

    // 복원
    process.env.SUPABASE_URL = originalUrl;
  });
});

describe('isTestEnv', () => {
  it('NODE_ENV=test 시 true를 반환해야 한다', () => {
    expect(isTestEnv()).toBe(true);
  });
});

describe('isProductionEnv', () => {
  it('NODE_ENV=test 시 false를 반환해야 한다', () => {
    expect(isProductionEnv()).toBe(false);
  });
});
