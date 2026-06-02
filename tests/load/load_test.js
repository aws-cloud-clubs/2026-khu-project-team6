/**
 * HARUMAN k6 부하 테스트 — 시나리오 A: 기본 부하 테스트 (Load Test)
 *
 * 동시 접속자(VU) 50명, 5분간 지속 시뮬레이션
 * 목표: Latency < 500ms, Error < 1%
 *
 * 실행: k6 run tests/load/load_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── 커스텀 메트릭 ──────────────────────────────────────────────────────────
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time_ms');

// ─── 테스트 설정 ────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    load_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% 요청이 500ms 미만
    error_rate: ['rate<0.01'],          // 에러율 1% 미만
  },
};

// ─── 환경변수 ───────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// ─── 테스트 시나리오 ────────────────────────────────────────────────────────
export default function () {
  // 1. 헬스체크
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
    'health: body ok': (r) => r.json('status') === 'ok',
  });
  errorRate.add(healthRes.status !== 200);
  responseTime.add(healthRes.timings.duration);

  // 2. 상품 목록 조회 (인증 불필요)
  const itemsRes = http.get(`${BASE_URL}/items`);
  check(itemsRes, {
    'items: status 200': (r) => r.status === 200,
  });
  errorRate.add(itemsRes.status !== 200);
  responseTime.add(itemsRes.timings.duration);

  // 3. 상품 상세 조회 (존재하지 않는 ID로 404 테스트 가능)
  const detailRes = http.get(`${BASE_URL}/items/00000000-0000-0000-0000-000000000001`);
  check(detailRes, {
    'item detail: status is expected': (r) => r.status === 200 || r.status === 404,
  });
  responseTime.add(detailRes.timings.duration);

  // VU 간 과부하 방지용 간격
  sleep(Math.random() * 2 + 1); // 1~3초 랜덤 대기
}
