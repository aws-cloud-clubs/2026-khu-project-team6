/**
 * 회원가입 엔드포인트 단위 테스트
 * POST /auth/register
 *
 * Requirements: 1.1, 1.2, 1.7, 1.8, 1.9, 15.3
 */

import { handler } from '../../../backend/src/auth/register';
import { resetConfigCache } from '../../../backend/src/common/config';
import * as sesModule from '../../../backend/src/mocks/ses';
import * as emailVerificationModule from '../../../backend/src/auth/emailVerification';

// ── Mock 설정 ──────────────────────────────────────────────────────────────

// Supabase 클라이언트 mock
jest.mock('../../../backend/src/db/client', () => ({
  getSupabaseClient: jest.fn(),
  resetSupabaseClient: jest.fn(),
}));

// SES mock
jest.mock('../../../backend/src/mocks/ses', () => ({
  mockSendVerificationEmail: jest.fn().mockResolvedValue({
    messageId: 'mock-message-id',
    success: true,
  }),
}));

// emailVerification mock
jest.mock('../../../backend/src/auth/emailVerification', () => ({
  createVerificationToken: jest.fn().mockResolvedValue({
    token: 'mock-verification-token-uuid',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }),
}));

import { getSupabaseClient } from '../../../backend/src/db/client';

// ── 헬퍼 함수 ──────────────────────────────────────────────────────────────

/** 정상 회원가입 요청 이벤트 생성 */
function makeRegisterEvent(overrides: Record<string, unknown> = {}) {
  const defaultBody = {
    real_name: '홍길동',
    email: 'test@example.com',
    phone: '010-1234-5678',
    nickname: 'testuser',
    password: 'password123',
    agreements: {
      terms_of_service: true,
      privacy_policy: true,
      deposit_policy: true,
    },
    ...overrides,
  };
  return { body: JSON.stringify(defaultBody) };
}

/** Supabase mock 설정 헬퍼 */
function setupSupabaseMock(options: {
  existingUsers?: unknown[];
  insertError?: { message: string } | null;
  insertedUser?: { id: string } | null;
  agreementError?: { message: string } | null;
}) {
  const {
    existingUsers = [],
    insertError = null,
    insertedUser = { id: 'new-user-uuid-123' },
    agreementError = null,
  } = options;

  const mockSingle = jest.fn().mockResolvedValue({
    data: insertedUser,
    error: insertError,
  });

  const mockInsertAgreements = jest.fn().mockResolvedValue({
    data: null,
    error: agreementError,
  });

  // from() 호출 순서에 따라 다른 mock 반환
  let callCount = 0;
  const mockFrom = jest.fn().mockImplementation((table: string) => {
    if (table === 'users') {
      callCount++;
      if (callCount === 1) {
        // 첫 번째 호출: 중복 확인 쿼리
        return {
          select: jest.fn().mockReturnValue({
            or: jest.fn().mockResolvedValue({
              data: existingUsers,
              error: null,
            }),
          }),
        };
      } else {
        // 두 번째 호출: 사용자 삽입 (롤백용 delete도 포함)
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
    }
    if (table === 'user_agreements') {
      return {
        insert: mockInsertAgreements,
      };
    }
    return {};
  });

  (getSupabaseClient as jest.Mock).mockReturnValue({ from: mockFrom });

  return { mockFrom, mockSingle, mockInsertAgreements };
}

// ── 테스트 설정 ────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  resetConfigCache();
  process.env.NODE_ENV = 'test';
});

// ── 테스트 케이스 ──────────────────────────────────────────────────────────

describe('POST /auth/register - 정상 회원가입', () => {
  it('모든 필드가 유효하면 201을 반환하고 userId와 메시지를 포함한다', async () => {
    setupSupabaseMock({});

    const event = makeRegisterEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.userId).toBe('new-user-uuid-123');
    expect(body.message).toBe('인증 이메일이 발송되었습니다.');
  });

  it('테스트 환경에서 mockSendVerificationEmail이 호출된다', async () => {
    setupSupabaseMock({});

    const event = makeRegisterEvent();
    await handler(event);

    expect(sesModule.mockSendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sesModule.mockSendVerificationEmail).toHaveBeenCalledWith(
      'test@example.com',
      'mock-verification-token-uuid',
      expect.stringContaining('/auth/verify-email'),
    );
  });

  it('createVerificationToken이 호출되어 토큰이 생성된다', async () => {
    setupSupabaseMock({});

    const event = makeRegisterEvent();
    await handler(event);

    expect(emailVerificationModule.createVerificationToken).toHaveBeenCalledTimes(1);
    expect(emailVerificationModule.createVerificationToken).toHaveBeenCalledWith(
      expect.anything(),
      'new-user-uuid-123',
    );
  });

  it('user_agreements 테이블에 3개의 약관 동의 레코드가 삽입된다', async () => {
    const { mockInsertAgreements } = setupSupabaseMock({});

    const event = makeRegisterEvent();
    await handler(event);

    expect(mockInsertAgreements).toHaveBeenCalledTimes(1);
    const insertedRecords = mockInsertAgreements.mock.calls[0][0] as Array<{
      agreement_type: string;
      agreement_version: string;
      agreed_at_utc: string;
    }>;
    expect(insertedRecords).toHaveLength(3);

    const types = insertedRecords.map((r) => r.agreement_type);
    expect(types).toContain('terms_of_service');
    expect(types).toContain('privacy_policy');
    expect(types).toContain('deposit_policy');

    // 모든 레코드에 버전과 UTC 타임스탬프가 있어야 함 (Requirements 15.3)
    for (const record of insertedRecords) {
      expect(record.agreement_version).toBe('v1.0');
      expect(record.agreed_at_utc).toBeTruthy();
      // ISO 8601 형식 확인
      expect(() => new Date(record.agreed_at_utc)).not.toThrow();
    }
  });
});

describe('POST /auth/register - 입력 유효성 검사 (Requirements 1.1)', () => {
  it('real_name이 없으면 422를 반환한다', async () => {
    const event = makeRegisterEvent({ real_name: '' });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('email 형식이 잘못되면 422를 반환한다', async () => {
    const event = makeRegisterEvent({ email: 'not-an-email' });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('phone이 없으면 422를 반환한다', async () => {
    const event = makeRegisterEvent({ phone: '' });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('nickname이 없으면 422를 반환한다', async () => {
    const event = makeRegisterEvent({ nickname: '' });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('password가 8자 미만이면 422를 반환한다', async () => {
    const event = makeRegisterEvent({ password: 'short' });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('요청 바디가 유효하지 않은 JSON이면 422를 반환한다', async () => {
    const event = { body: 'invalid-json' };
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/register - 중복 필드 거부 (Requirements 1.5, 1.6)', () => {
  it('이미 사용 중인 이메일이면 422 DUPLICATE_FIELD를 반환한다', async () => {
    setupSupabaseMock({
      existingUsers: [
        { email: 'test@example.com', nickname: 'other', phone: '010-9999-9999' },
      ],
    });

    const event = makeRegisterEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('DUPLICATE_FIELD');
    expect(body.error.message).toContain('이메일');
  });

  it('이미 사용 중인 닉네임이면 422 DUPLICATE_FIELD를 반환한다', async () => {
    setupSupabaseMock({
      existingUsers: [
        { email: 'other@example.com', nickname: 'testuser', phone: '010-9999-9999' },
      ],
    });

    const event = makeRegisterEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('DUPLICATE_FIELD');
    expect(body.error.message).toContain('닉네임');
  });

  it('이미 사용 중인 전화번호이면 422 DUPLICATE_FIELD를 반환한다', async () => {
    setupSupabaseMock({
      existingUsers: [
        { email: 'other@example.com', nickname: 'other', phone: '010-1234-5678' },
      ],
    });

    const event = makeRegisterEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('DUPLICATE_FIELD');
    expect(body.error.message).toContain('전화번호');
  });
});

describe('POST /auth/register - 약관 미동의 거부 (Requirements 1.8, 1.9, 15.3)', () => {
  it('terms_of_service가 false이면 422 VALIDATION_ERROR를 반환한다', async () => {
    const event = makeRegisterEvent({
      agreements: {
        terms_of_service: false,
        privacy_policy: true,
        deposit_policy: true,
      },
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('모든 필수 약관에 동의해 주세요.');
  });

  it('privacy_policy가 false이면 422 VALIDATION_ERROR를 반환한다', async () => {
    const event = makeRegisterEvent({
      agreements: {
        terms_of_service: true,
        privacy_policy: false,
        deposit_policy: true,
      },
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('모든 필수 약관에 동의해 주세요.');
  });

  it('deposit_policy가 false이면 422 VALIDATION_ERROR를 반환한다', async () => {
    const event = makeRegisterEvent({
      agreements: {
        terms_of_service: true,
        privacy_policy: true,
        deposit_policy: false,
      },
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('모든 필수 약관에 동의해 주세요.');
  });

  it('agreements 객체가 없으면 422 VALIDATION_ERROR를 반환한다', async () => {
    const event = makeRegisterEvent({ agreements: undefined });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('모든 필수 약관에 동의해 주세요.');
  });

  it('3개 약관 모두 미동의이면 422 VALIDATION_ERROR를 반환한다', async () => {
    const event = makeRegisterEvent({
      agreements: {
        terms_of_service: false,
        privacy_policy: false,
        deposit_policy: false,
      },
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('모든 필수 약관에 동의해 주세요.');
  });
});

describe('POST /auth/register - 서버 오류 처리', () => {
  it('DB 삽입 오류 시 500 INTERNAL_ERROR를 반환한다', async () => {
    setupSupabaseMock({
      insertError: { message: 'DB connection failed' },
      insertedUser: null,
    });

    const event = makeRegisterEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('약관 동의 저장 오류 시 500 INTERNAL_ERROR를 반환한다', async () => {
    setupSupabaseMock({
      agreementError: { message: 'Agreement insert failed' },
    });

    const event = makeRegisterEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
