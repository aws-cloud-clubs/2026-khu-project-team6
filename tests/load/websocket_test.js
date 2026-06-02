/**
 * HARUMAN k6 부하 테스트 — 시나리오 D: 웹소켓 지속 연결 테스트 (WebSocket Persistent)
 *
 * 경량 EC2(t4g.nano/micro) 채팅 서버에 동시 500개 웹소켓 커넥션을 수립하고
 * 5분 동안 연결을 유지하며 안정성 테스트
 *
 * 실행: k6 run tests/load/websocket_test.js
 * 환경변수: WS_URL (웹소켓 서버 주소), AUTH_TOKEN (JWT 토큰)
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── 커스텀 메트릭 ──────────────────────────────────────────────────────────
const wsConnectionSuccess = new Rate('ws_connection_success');
const wsConnectionDuration = new Trend('ws_connection_duration_ms');
const wsDisconnects = new Counter('ws_unexpected_disconnects');
const wsMessagesSent = new Counter('ws_messages_sent');
const wsMessagesReceived = new Counter('ws_messages_received');

// ─── 테스트 설정 ────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    websocket_persistent: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },   // 30초간 100개 연결 수립
        { duration: '30s', target: 300 },   // 300개까지 증가
        { duration: '30s', target: 500 },   // 500개까지 도달
        { duration: '5m', target: 500 },    // 5분간 500개 유지
        { duration: '30s', target: 0 },     // 정리
      ],
    },
  },
  thresholds: {
    ws_connection_success: ['rate>0.95'],        // 95% 이상 연결 성공
    ws_unexpected_disconnects: ['count<50'],      // 비정상 끊김 50건 미만
    ws_connection_duration_ms: ['p(95)<310000'],  // 대부분 5분+ 유지
  },
};

// ─── 환경변수 ───────────────────────────────────────────────────────────────
const WS_URL = __ENV.WS_URL || 'ws://localhost:4000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-jwt-token';

// ─── 테스트 시나리오 ────────────────────────────────────────────────────────
export default function () {
  const url = `${WS_URL}?token=${encodeURIComponent(AUTH_TOKEN)}`;
  const connectionStart = Date.now();
  let connected = false;

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      connected = true;
      wsConnectionSuccess.add(1);

      // 연결 유지: 30초마다 ping 메시지 전송 (keep-alive)
      socket.setInterval(() => {
        socket.send(JSON.stringify({ action: 'ping' }));
        wsMessagesSent.add(1);
      }, 30000);
    });

    socket.on('message', (msg) => {
      wsMessagesReceived.add(1);
      // 메시지 수신 검증
      try {
        const data = JSON.parse(msg);
        check(data, {
          'ws: message has type': (d) => d.type !== undefined || d.action !== undefined,
        });
      } catch {
        // 비-JSON 메시지도 허용 (pong 응답 등)
      }
    });

    socket.on('close', () => {
      const duration = Date.now() - connectionStart;
      wsConnectionDuration.add(duration);

      // 5분(300초) 미만에 끊기면 비정상 끊김으로 카운트
      if (duration < 290000) {
        wsDisconnects.add(1);
      }
    });

    socket.on('error', () => {
      wsDisconnects.add(1);
    });

    // 5분간 연결 유지 (sleep으로 VU 블로킹)
    socket.setTimeout(() => {
      socket.close();
    }, 300000); // 300초 = 5분
  });

  if (!connected) {
    wsConnectionSuccess.add(0);
  }

  check(res, {
    'ws: connection established': (r) => r && r.status === 101,
  });
}

// ─── 테스트 종료 시 요약 ────────────────────────────────────────────────────
export function handleSummary(data) {
  const successRate = data.metrics.ws_connection_success?.values?.rate
    ? (data.metrics.ws_connection_success.values.rate * 100).toFixed(1)
    : 'N/A';
  const disconnects = data.metrics.ws_unexpected_disconnects?.values?.count || 0;
  const msgSent = data.metrics.ws_messages_sent?.values?.count || 0;
  const msgRecv = data.metrics.ws_messages_received?.values?.count || 0;

  return {
    stdout: `
╔══════════════════════════════════════════════════╗
║       WebSocket Persistence Test Results         ║
╠══════════════════════════════════════════════════╣
║  Connection Success:   ${String(successRate + '%').padEnd(24)}║
║  Unexpected Disconnects: ${String(disconnects).padEnd(22)}║
║  Messages Sent:        ${String(msgSent).padEnd(24)}║
║  Messages Received:    ${String(msgRecv).padEnd(24)}║
╚══════════════════════════════════════════════════╝
`,
  };
}
