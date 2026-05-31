/**
 * 환경변수 로더
 * 필수 환경변수가 없을 경우 명확한 오류 메시지와 함께 실패합니다.
 * Requirements: 14.5
 */

/** 플랫폼 환경 타입 */
export type NodeEnv = 'development' | 'test' | 'production';

/** 애플리케이션 설정 인터페이스 */
export interface AppConfig {
  /** 현재 실행 환경 */
  nodeEnv: NodeEnv;
  /** Supabase 프로젝트 URL */
  supabaseUrl: string;
  /** Supabase 서비스 롤 키 (서버 전용) */
  supabaseServiceKey: string;
  /** JWT 서명 비밀키 */
  jwtSecret: string;
  /** SES 발신자 이메일 주소 */
  sesFromEmail: string;
  /** AWS Bedrock 리전 */
  bedrockRegion: string;
  /** S3 버킷 이름 */
  s3Bucket: string;
  /** WebSocket API Gateway 엔드포인트 */
  wsEndpoint: string;
}

/**
 * 환경변수 값을 읽어 반환합니다.
 * 값이 없으면 오류를 던집니다.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`필수 환경변수 '${key}'가 설정되지 않았습니다.`);
  }
  return value;
}

/**
 * 환경변수 값을 읽어 반환합니다.
 * 값이 없으면 기본값을 반환합니다.
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * 현재 환경변수를 기반으로 애플리케이션 설정을 로드합니다.
 * 테스트 환경에서는 jest.setup.js에서 설정된 값을 사용합니다.
 */
export function loadConfig(): AppConfig {
  const nodeEnv = (optionalEnv('NODE_ENV', 'development') as NodeEnv);

  return {
    nodeEnv,
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseServiceKey: requireEnv('SUPABASE_SERVICE_KEY'),
    jwtSecret: requireEnv('JWT_SECRET'),
    sesFromEmail: requireEnv('SES_FROM_EMAIL'),
    bedrockRegion: optionalEnv('BEDROCK_REGION', 'ap-northeast-2'),
    s3Bucket: requireEnv('S3_BUCKET'),
    wsEndpoint: optionalEnv('WS_ENDPOINT', ''),
  };
}

/**
 * 현재 환경이 테스트 환경인지 확인합니다.
 */
export function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * 현재 환경이 프로덕션 환경인지 확인합니다.
 */
export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

// 싱글턴 설정 인스턴스 (Lambda 콜드 스타트 시 한 번만 로드)
let _config: AppConfig | null = null;

/**
 * 캐시된 설정 인스턴스를 반환합니다.
 * 처음 호출 시 환경변수를 로드하고 이후에는 캐시된 값을 반환합니다.
 */
export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * 테스트에서 설정 캐시를 초기화합니다.
 * @internal 테스트 전용
 */
export function resetConfigCache(): void {
  _config = null;
}
