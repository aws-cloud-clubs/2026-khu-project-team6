# Implementation Plan:

## Overview

HARUMAN 렌탈 플랫폼의 초경량 WebSocket 채팅 서버를 단일 Node.js 파일(`ws-chat-server.js`)로 구현한다. 순정 ws 모듈 기반, 500 동시 접속 지원, Bedrock Nova Lite 클린봇 검열, Supabase 연동을 포함한다.

## Tasks

- [ ] 1. 프로젝트 초기화: `backend/ws-chat-server/` 디렉토리 생성, `package.json` 작성 (ws, @supabase/supabase-js, @aws-sdk/client-bedrock-runtime, dotenv 의존성), `.env.example` 생성
- [ ] 2. 환경변수 및 싱글톤 초기화 섹션 구현: dotenv.config(), 필수 변수 검증, Supabase 클라이언트 싱글톤 생성, BedrockRuntimeClient 싱글톤 생성 (region: ap-northeast-2, modelId 설정)
- [ ] 3. Background Write 유틸리티 구현: `bgWrite(promise)` 함수 — Promise를 받아 .catch로 에러 로깅만 수행, 호출자에게 throw하지 않음
- [ ] 4. WebSocket 서버 부트스트랩: `new WebSocketServer({ port })` 생성, connection 이벤트 바인딩, 서버 시작 로그 출력
- [ ] 5. 연결 인증 및 채팅방 조인: URL query에서 token/roomId 추출, Supabase auth.getUser(token) 인증, chat_rooms 테이블에서 seller_id/buyer_id 매칭 검증, ws.userId/ws.roomId/ws.isAlive 바인딩, bgWrite로 ws_connections INSERT
- [ ] 6. Clean Bot 검열 함수 구현: InvokeModelCommand 생성 (시스템 프롬프트, maxTokens: 5, temperature: 0.0), 5초 타임아웃 Promise.race, 응답에서 PASSED/BANNED 추출, 실패 시 PASSED fallback
- [ ] 7. Broadcast 함수 구현: `broadcast(roomId, messageJSON, excludeWs)` — wss.clients Set 순회, roomId 매칭, readyState === OPEN 확인, client.send() 호출
- [ ] 8. 메시지 핸들러 구현: ws.on('message') 에서 JSON 파싱, type === "chat" 분기, content 유효성 검사, Clean Bot 호출, PASSED 경로 (원본 broadcast + bgWrite INSERT), BANNED 경로 (치환 broadcast + bgWrite INSERT)
- [ ] 9. 연결 해제 처리: ws.on('close') 및 ws.on('error') 핸들러, bgWrite로 ws_connections DELETE, 중복 삭제 방지
- [ ] 10. Heartbeat Manager 구현: setInterval로 PING_INTERVAL_MS 주기 ping 전송, isAlive === false 시 ws.terminate() + bgWrite DELETE, ws.on('pong') 핸들러로 isAlive = true + bgWrite UPDATE last_ping_at
- [ ] 11. 메모리 보호 로직: 주기적 process.memoryUsage().heapUsed 체크, MEMORY_THRESHOLD_MB 초과 시 경고 로그 + 새 연결 거부, 임계값 이하 복구 시 연결 수락 재개
- [ ] 12. Graceful Shutdown: SIGTERM/SIGINT 핸들러, heartbeat clearInterval, 모든 연결 close + terminate, wss.close() 후 프로세스 종료
- [ ] 13. 500 동시 접속 부하 테스트 스크립트 작성: ws 모듈로 500개 클라이언트 동시 연결, 메시지 송수신 검증, 메모리 사용량 출력

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": ["1"]},
    {"tasks": ["2"]},
    {"tasks": ["3", "4"]},
    {"tasks": ["5", "6", "7"]},
    {"tasks": ["8", "9", "10", "11"]},
    {"tasks": ["12"]},
    {"tasks": ["13"]}
  ]
}
```

## Notes

- 모든 코드는 단일 파일 `ws-chat-server.js`에 작성 (Node.js로 직접 실행 가능)
- Socket.io, Express-ws 등 외부 WebSocket 프레임워크 사용 금지
- DB 쓰기는 반드시 bgWrite 패턴 사용 (await 금지)
- Clean Bot 검열만 await 허용 (메시지 전달 전 판정 필요)
- 서울 리전 (ap-northeast-2) Bedrock Nova Lite 사용
- 월 $30 예산 내 단일 t3.micro/t4g.micro EC2 인스턴스 운영 전제
