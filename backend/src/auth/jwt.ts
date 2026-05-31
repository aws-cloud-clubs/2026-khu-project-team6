/**
 * JWT 유틸리티 모듈
 * jsonwebtoken을 사용하여 JWT 발급 및 검증을 처리합니다.
 * Requirements: 2.3, 2.4
 */

import jwt from 'jsonwebtoken';
import { AppError, ErrorCodes } from '../common/errors';
import { getConfig } from '../common/config';

/** JWT 페이로드 인터페이스 */
export interface JWTPayload {
  /** 사용자 ID */
  sub: string;
  /** 사용자 역할 */
  role: 'user' | 'admin';
  /** 이메일 주소 */
  email: string;
  /** 발급 시각 (Unix timestamp) */
  iat: number;
  /** 만료 시각 (iat + 86400, Unix timestamp) */
  exp: number;
}

/** JWT 발급 입력 파라미터 */
export interface SignJWTInput {
  userId: string;
  role: 'user' | 'admin';
  email: string;
}

/**
 * JWT를 발급합니다.
 * 만료 시간은 발급 시각으로부터 정확히 86400초(24시간) 후입니다.
 *
 * @param payload - 토큰에 포함할 사용자 정보
 * @returns 서명된 JWT 문자열
 */
export function signJWT(payload: SignJWTInput): string {
  const { jwtSecret } = getConfig();

  return jwt.sign(
    {
      role: payload.role,
      email: payload.email,
    },
    jwtSecret,
    {
      subject: payload.userId,
      expiresIn: 86400, // 24시간 (초 단위)
    },
  );
}

/**
 * JWT를 검증하고 페이로드를 반환합니다.
 * 만료되었거나 서명이 잘못된 경우 AppError(401)를 던집니다.
 *
 * @param token - 검증할 JWT 문자열
 * @returns 검증된 JWT 페이로드
 * @throws AppError(401) - 토큰이 만료되었거나 서명이 유효하지 않은 경우
 */
export function verifyJWT(token: string): JWTPayload {
  const { jwtSecret } = getConfig();

  try {
    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload;

    // 필수 클레임 검증
    if (!decoded.sub || !decoded.role || !decoded.email) {
      throw new AppError(401, ErrorCodes.INVALID_TOKEN, '유효하지 않은 토큰입니다.');
    }

    // role 값 검증
    if (decoded.role !== 'user' && decoded.role !== 'admin') {
      throw new AppError(401, ErrorCodes.INVALID_TOKEN, '유효하지 않은 토큰입니다.');
    }

    return {
      sub: decoded.sub,
      role: decoded.role as 'user' | 'admin',
      email: decoded.email as string,
      iat: decoded.iat as number,
      exp: decoded.exp as number,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, ErrorCodes.TOKEN_EXPIRED, '토큰이 만료되었습니다.');
    }

    // JsonWebTokenError, NotBeforeError 등 모든 JWT 오류
    throw new AppError(401, ErrorCodes.INVALID_TOKEN, '유효하지 않은 토큰입니다.');
  }
}
