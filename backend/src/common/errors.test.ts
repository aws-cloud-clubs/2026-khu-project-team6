/**
 * AppError 클래스 및 withErrorHandling 래퍼 단위 테스트
 */

import { AppError, ErrorCodes, withErrorHandling } from './errors';

describe('AppError', () => {
  it('statusCode, code, message를 올바르게 저장해야 한다', () => {
    const error = new AppError(404, ErrorCodes.NOT_FOUND, '리소스를 찾을 수 없습니다.');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('리소스를 찾을 수 없습니다.');
    expect(error.name).toBe('AppError');
  });

  it('instanceof AppError 검사가 올바르게 동작해야 한다', () => {
    const error = new AppError(400, ErrorCodes.VALIDATION_ERROR, '유효성 검사 실패');
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });

  it('다양한 상태 코드를 지원해야 한다', () => {
    const codes = [400, 401, 403, 404, 422, 423, 500];
    codes.forEach((code) => {
      const error = new AppError(code, 'TEST_CODE', 'test message');
      expect(error.statusCode).toBe(code);
    });
  });
});

describe('withErrorHandling', () => {
  it('핸들러가 성공적으로 응답을 반환하면 그대로 전달해야 한다', async () => {
    const mockResponse = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test' }),
    };
    const handler = jest.fn().mockResolvedValue(mockResponse);
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({ httpMethod: 'GET' });
    expect(result).toEqual(mockResponse);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('AppError 발생 시 해당 statusCode와 오류 코드로 응답해야 한다', async () => {
    const handler = jest.fn().mockRejectedValue(
      new AppError(404, ErrorCodes.NOT_FOUND, '아이템을 찾을 수 없습니다.'),
    );
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({});
    expect(result.statusCode).toBe(404);

    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('아이템을 찾을 수 없습니다.');
  });

  it('예상치 못한 오류 발생 시 500 응답을 반환해야 한다', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('DB 연결 실패'));
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({});
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('서버 오류가 발생했습니다.');
  });

  it('오류 응답에 Content-Type 헤더가 포함되어야 한다', async () => {
    const handler = jest.fn().mockRejectedValue(
      new AppError(401, ErrorCodes.UNAUTHORIZED, '인증이 필요합니다.'),
    );
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({});
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});
