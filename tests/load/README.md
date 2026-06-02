# HARUMAN k6 부하 테스트

## 설치

```bash
# macOS
brew install k6

# Windows (Chocolatey)
choco install k6

# Docker
docker pull grafana/k6
```

## 실행 방법

### 환경변수 설정

```bash
export BASE_URL=http://localhost:4000        # 백엔드 URL
export WS_URL=ws://localhost:4000            # WebSocket URL
export AUTH_TOKEN=<로그인_후_발급받은_JWT>     # 인증 토큰
```

### 시나리오별 실행

```bash
# A. 기본 부하 테스트 (50VU, 5분)
k6 run -e BASE_URL=http://localhost:4000 tests/load/load_test.js

# B. 스파이크 테스트 (10→200→10 VU)
k6 run -e BASE_URL=http://localhost:4000 tests/load/spike_test.js

# C. AI 추론 트래픽 테스트 (Bedrock 병목 검증)
k6 run -e BASE_URL=http://localhost:4000 -e AUTH_TOKEN=<JWT> tests/load/ai_inference_test.js

# D. WebSocket 지속 연결 테스트 (500 커넥션, 5분 유지)
k6 run -e WS_URL=ws://localhost:4000 -e AUTH_TOKEN=<JWT> tests/load/websocket_test.js
```

### 결과를 JSON으로 출력

```bash
k6 run --out json=results.json tests/load/load_test.js
```

## 성능 목표

| 시나리오 | 메트릭 | 목표 |
|---------|--------|------|
| A. Load | P95 Latency | < 500ms |
| A. Load | Error Rate | < 1% |
| B. Spike | P95 Latency | < 2000ms |
| B. Spike | Error Rate | < 5% |
| C. AI | P95 Latency | < 6000ms |
| C. AI | Timeout Rate | 정상 동작 |
| D. WS | Connection Success | > 95% |
| D. WS | Unexpected Disconnects | < 50 |

## Grafana 연동

백엔드의 `GET /metrics` 엔드포인트가 Prometheus 형식으로 메트릭을 노출합니다.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'haruman-backend'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/metrics'
```

### 제공 메트릭

- `http_requests_total` — HTTP 요청 수 (method, route, status_code)
- `http_request_duration_seconds` — 요청 응답 시간 히스토그램
- `http_errors_total` — 에러 카운터 (4xx/5xx)
- `bedrock_inference_duration_seconds` — AI 추론 레이턴시
- `bedrock_timeouts_total` — Bedrock 타임아웃 횟수
- `ws_active_connections` — 활성 WebSocket 연결 수
