/**
 * HARUMAN k6 부하 테스트 — 시나리오 C: AI 추론 트래픽 테스트 (Inference)
 *
 * Bedrock AI 엔드포인트(POST /ai/chat)를 집중 타격하여
 * 5초 타임아웃 예외 처리, 병목 현상 검증
 *
 * 실행: k6 run tests/load/ai_inference_test.js
 * 환경변수: BASE_URL, AUTH_TOKEN (로그인 후 발급받은 JWT)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── 커스텀 메트릭 ──────────────────────────────────────────────────────────
const aiErrorRate = new Rate('ai_error_rate');
const aiLatency = new Trend('ai_latency_ms');
const aiTimeouts = new Counter('ai_timeouts');

// ─── 테스트 설정 ────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    ai_inference: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 20 },   // 점진적 증가
        { duration: '2m', target: 20 },    // 안정적 유지
        { duration: '30s', target: 40 },   // 부하 증가
        { duration: '1m', target: 40 },    // 고부하 유지
        { duration: '30s', target: 5 },    // 감소
      ],
    },
  },
  thresholds: {
    ai_latency_ms: ['p(95)<6000'],     // 95%가 6초 미만 (5초 타임아웃 + 버퍼)
    ai_error_rate: ['rate<0.1'],        // AI 에러율 10% 미만
    http_req_failed: ['rate<0.15'],     // 전체 요청 실패율 15% 미만
  },
};

// ─── 환경변수 ───────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-jwt-token';

// ─── AI 추론 요청 메시지 풀 ──────────────────────────────────────────────────
const messages = [
  '캠핑 가는데 뭐 빌려야 할까?',
  '졸업식에 필요한 물건 추천해줘',
  '여행 갈 때 빌리면 좋은 것들',
  '면접 준비 중인데 필요한 거 있어?',
  '콘서트 가는데 뭐가 필요해?',
  '소풍 가는데 추천해줘',
  '결혼식 하객으로 가는데',
  '해수욕장 놀러 가는데 뭐 빌리지',
  '등산 준비물 추천',
  '축제 갈 때 빌릴 물건',
];

// ─── 테스트 시나리오 ────────────────────────────────────────────────────────
export default function () {
  const message = messages[Math.floor(Math.random() * messages.length)];

  const payload = JSON.stringify({ message });
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/ai/chat`, payload, { headers, timeout: '10s' });
  const latency = Date.now() - startTime;

  aiLatency.add(latency);

  // 타임아웃 판정: 서버가 fallback 메시지를 반환했는지 확인
  const isTimeout = res.status === 200 &&
    res.body && res.body.includes('AI 응답 시간이 초과되었습니다');

  if (isTimeout) {
    aiTimeouts.add(1);
  }

  check(res, {
    'ai: status 200 or 401': (r) => r.status === 200 || r.status === 401,
    'ai: has reply field': (r) => {
      try { return JSON.parse(r.body).reply !== undefined; }
      catch { return false; }
    },
    'ai: latency under 6s': () => latency < 6000,
  });

  aiErrorRate.add(res.status >= 500);

  // AI 호출 간 간격 (Bedrock 쓰로틀링 방지)
  sleep(Math.random() * 2 + 1); // 1~3초
}

// ─── 테스트 종료 시 요약 ────────────────────────────────────────────────────
export function handleSummary(data) {
  const p95 = data.metrics.ai_latency_ms?.values?.['p(95)'] || 'N/A';
  const timeouts = data.metrics.ai_timeouts?.values?.count || 0;
  const errorPct = data.metrics.ai_error_rate?.values?.rate
    ? (data.metrics.ai_error_rate.values.rate * 100).toFixed(2)
    : 'N/A';

  return {
    stdout: `
╔══════════════════════════════════════════════════╗
║         AI Inference Test Results                ║
╠══════════════════════════════════════════════════╣
║  P95 Latency:     ${String(p95).padEnd(28)}║
║  Timeout Count:   ${String(timeouts).padEnd(28)}║
║  Error Rate:      ${String(errorPct + '%').padEnd(28)}║
╚══════════════════════════════════════════════════╝
`,
  };
}
