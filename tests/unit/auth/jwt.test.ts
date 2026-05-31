/**
 * JWT 유틸리티 단위 테스트
 * signJWT, verifyJWT 함수의 동작을 검증합니다.
 * Requirements: 2.3, 2.4
 */

import jwt from 'jsonwebtoken';
import { signJWT, verifyJWT, JWTPayload } from '../../../backend/src/auth/jwt';
import { AppError } from '../../../backend/src/common/errors';
import { resetConfigCache } from '../../../backend/src/common/config';

// 각 테스트 전에 설정 캐시 초기화
beforeEach(() => {
  resetConfigCache();
});

describe('signJWT', () => {
  it('유효한 JWT를 발급한다', () => {
    const token = signJWT({
      userId: 'user-123',
      role: 'user',
      email: 'test@example.com',
    });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('발급된 JWT에 올바른 sub, role, email 클레임이 포함된다', () => {
    const token = signJWT({
      userId: 'user-abc',
      role: 'admin',
      email: 'admin@example.com',
    });

    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded.sub).toBe('user-abc');
    expect(decoded.role).toBe('admin');
    expect(decoded.email).toBe('admin@example.com');
  });

  it('exp = iat + 86400 (24시간) 이다', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signJWT({
      userId: 'user-123',
      role: 'user',
      email: 'test@example.com',
    });
    const after = Math.floor(Date.now() / 1000);

    const decoded = jwt.decode(token) as jwt.JwtPayload;
    const iat = decoded.iat as number;
    const exp = decoded.exp as number;

    // iat는 발급 시각 범위 내에 있어야 함
    expect(iat).toBeGreaterThanOrEqual(before);
    expect(iat).toBeLessThanOrEqual(after);

    // exp = iat + 86400
    expect(exp).toBe(iat + 86400);
  });

  it('user 역할로 JWT를 발급할 수 있다', () => {
    const token = signJWT({
      userId: 'user-456',
      role: 'user',
      email: 'user@example.com',
    });

    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded.role).toBe('user');
  });

  it('admin 역할로 JWT를 발급할 수 있다', () => {
    const token = signJWT({
      userId: 'admin-789',
      role: 'admin',
      email: 'admin@example.com',
    });

    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded.role).toBe('admin');
  });
});

describe('verifyJWT', () => {
  it('유효한 JWT를 검증하고 페이로드를 반환한다', () => {
    const token = signJWT({
      userId: 'user-123',
      role: 'user',
      email: 'test@example.com',
    });

    const payload: JWTPayload = verifyJWT(token);

    expect(payload.sub).toBe('user-123');
    expect(payload.role).toBe('user');
    expect(payload.email).toBe('test@example.com');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('검증된 페이로드의 exp = iat + 86400 이다', () => {
    const token = signJWT({
      userId: 'user-123',
      role: 'user',
      email: 'test@example.com',
    });

    const payload = verifyJWT(token);
    expect(payload.exp).toBe(payload.iat + 86400);
  });

  it('만료된 JWT 검증 시 AppError(401)를 던진다', () => {
    // 이미 만료된 토큰 생성 (expiresIn: -1초)
    const expiredToken = jwt.sign(
      { role: 'user', email: 'test@example.com' },
      process.env.JWT_SECRET as string,
      { subject: 'user-123', expiresIn: -1 },
    );

    expect(() => verifyJWT(expiredToken)).toThrow(AppError);

    try {
      verifyJWT(expiredToken);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(401);
      expect((error as AppError).code).toBe('TOKEN_EXPIRED');
    }
  });

  it('잘못된 서명의 JWT 검증 시 AppError(401)를 던진다', () => {
    // 다른 시크릿으로 서명된 토큰
    const invalidToken = jwt.sign(
      { role: 'user', email: 'test@example.com' },
      'wrong-secret-key',
      { subject: 'user-123', expiresIn: 86400 },
    );

    expect(() => verifyJWT(invalidToken)).toThrow(AppError);

    try {
      verifyJWT(invalidToken);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(401);
      expect((error as AppError).code).toBe('INVALID_TOKEN');
    }
  });

  it('완전히 잘못된 형식의 토큰 검증 시 AppError(401)를 던진다', () => {
    expect(() => verifyJWT('not-a-valid-jwt')).toThrow(AppError);

    try {
      verifyJWT('not-a-valid-jwt');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(401);
    }
  });

  it('빈 문자열 토큰 검증 시 AppError(401)를 던진다', () => {
    expect(() => verifyJWT('')).toThrow(AppError);
  });

  it('role 클레임이 없는 JWT 검증 시 AppError(401)를 던진다', () => {
    // role 없이 서명된 토큰
    const tokenWithoutRole = jwt.sign(
      { email: 'test@example.com' },
      process.env.JWT_SECRET as string,
      { subject: 'user-123', expiresIn: 86400 },
    );

    expect(() => verifyJWT(tokenWithoutRole)).toThrow(AppError);

    try {
      verifyJWT(tokenWithoutRole);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(401);
    }
  });

  it('유효하지 않은 role 값을 가진 JWT 검증 시 AppError(401)를 던진다', () => {
    // 잘못된 role 값으로 서명된 토큰
    const tokenWithInvalidRole = jwt.sign(
      { role: 'superuser', email: 'test@example.com' },
      process.env.JWT_SECRET as string,
      { subject: 'user-123', expiresIn: 86400 },
    );

    expect(() => verifyJWT(tokenWithInvalidRole)).toThrow(AppError);

    try {
      verifyJWT(tokenWithInvalidRole);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(401);
    }
  });
});
