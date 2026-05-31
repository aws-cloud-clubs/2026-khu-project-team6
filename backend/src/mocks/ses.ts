/**
 * AWS SES Mock
 * NODE_ENV=test 시 실제 이메일 발송 대신 console.log로 출력합니다.
 * Requirements: 14.5, 11.4
 */

/** SES 이메일 발송 파라미터 */
export interface SendEmailParams {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
}

/** SES 이메일 발송 결과 */
export interface SendEmailResult {
  messageId: string;
  success: boolean;
}

/**
 * Mock SES 이메일 발송 함수
 * 실제 이메일을 발송하지 않고 콘솔에 출력합니다.
 */
export async function mockSendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const recipients = Array.isArray(params.to) ? params.to.join(', ') : params.to;
  const mockMessageId = `mock-ses-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // NODE_ENV=test 시 console.log로 이메일 내용 출력 (Requirements 11.4)
  console.info('[SES MOCK] 이메일 발송 시뮬레이션:', {
    messageId: mockMessageId,
    to: recipients,
    subject: params.subject,
    htmlBody: params.htmlBody.slice(0, 200) + (params.htmlBody.length > 200 ? '...' : ''),
    timestamp: new Date().toISOString(),
  });

  return {
    messageId: mockMessageId,
    success: true,
  };
}

/**
 * Mock SES 인증 이메일 발송
 */
export async function mockSendVerificationEmail(
  email: string,
  verificationToken: string,
  verificationUrl: string,
): Promise<SendEmailResult> {
  return mockSendEmail({
    to: email,
    subject: '[HARUMAN] 이메일 인증을 완료해 주세요',
    htmlBody: `
      <h1>HARUMAN 이메일 인증</h1>
      <p>아래 링크를 클릭하여 이메일 인증을 완료해 주세요.</p>
      <a href="${verificationUrl}?token=${verificationToken}">이메일 인증하기</a>
      <p>링크는 24시간 동안 유효합니다.</p>
    `,
    textBody: `이메일 인증 링크: ${verificationUrl}?token=${verificationToken}`,
  });
}

/**
 * Mock SES 반납 기한 임박 알림 이메일 발송
 */
export async function mockSendReturnReminderEmail(
  email: string,
  rentalId: string,
  itemName: string,
  returnDeadlineKST: string,
): Promise<SendEmailResult> {
  return mockSendEmail({
    to: email,
    subject: '[HARUMAN] 반납 기한이 임박했습니다',
    htmlBody: `
      <h1>반납 기한 임박 알림</h1>
      <p>대여 ID: ${rentalId}</p>
      <p>물품명: ${itemName}</p>
      <p>반납 기한: ${returnDeadlineKST} (KST)</p>
      <p>기한 내에 반납하지 않으면 보증금이 차감될 수 있습니다.</p>
    `,
    textBody: `[HARUMAN] 대여 ID: ${rentalId}, 물품명: ${itemName}, 반납 기한: ${returnDeadlineKST} (KST)`,
  });
}
