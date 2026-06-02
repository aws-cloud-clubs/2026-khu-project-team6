/**
 * HARUMAN k6 부하 테스트 — 시나리오 B: 스파이크 테스트 (Spike Test)
 *
 * 10명 → 30초 만에 200명 급증 → 1분 유지 → 다시 10명으로 감소
 * 목표: 급격한 트래픽 증가/감소 시 시스템 안정성 검증
 *
 * 실행: k6 run tests/load/spike_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── 커스텀 메트릭 ──────────────────────────────────────────────────────────
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time_ms');

// ─── 스파이크 테스트 설정 ───────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 10 },    // 워밍업: 10명
    { duration: '30s', target: 200 },   // 스파이크: 30초 만에 200명으로 급증
    { duration: '1m', target: 200 },    // 유지: 200명으로 1분간 유지
    { duration: '30s', target: 10 },    // 램프다운: 30초 만에 10명으로 감소
    { duration: '30s', target: 10 },    // 안정화: 10명 유지
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 스파이크에서도 95%가 2초 미만
    error_rate: ['rate<0.05'],          // 에러율 5% 미만 (스파이크 허용)
    http_req_failed: ['rate<0.05'],
  },
};

// ─── 환경변수 ───────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// ─── 테스트 시나리오 ────────────────────────────────────────────────────────
export default function () {
  // 혼합 트래픽: 헬스체크 + 상품 조회 + 인증 API
  const requests = [
    { method: 'GET', url: `${BASE_URL}/health` },
    { method: 'GET', url: `${BASE_URL}/items` },
    { method: 'GET', url: `${BASE_URL}/auth/check-duplicate?field=email&value=test${__VU}@example.com` },
  ];

  const req = requests[Math.floor(Math.random() * requests.length)];
  const res = http.get(req.url);

  check(res, {
    'spike: response received': (r) => r.status < 500,
    'spike: latency ok': (r) => r.timings.duration < 5000,
  });

  errorRate.add(res.status >= 500);
  responseTime.add(res.timings.duration);

  sleep(Math.random() * 0.5 + 0.1); // 0.1~0.6초 (높은 부하 시뮬레이션)
}
