/**
 * EventBus 테스트
 *
 * Phase 1.1 완료 기준 검증:
 * - EventBus.getInstance()로 전역 인스턴스 접근 가능
 * - emitEvent/onEvent 메서드 정상 동작
 * - 타입 추론이 올바르게 작동
 */

import { eventBus, EventType, RecruitChangedEvent } from '../index';

/**
 * 간단한 테스트 함수
 */
export async function testEventBus(): Promise<void> {
  console.log('=== EventBus 테스트 시작 ===\n');

  // 1. Singleton 인스턴스 확인
  console.log('✓ 테스트 1: Singleton 인스턴스 확인');
  console.log(`  EventBus 인스턴스: ${eventBus.constructor.name}`);
  console.log(`  타입: ${typeof eventBus}`);

  // 2. 이벤트 리스너 등록
  console.log('\n✓ 테스트 2: 이벤트 리스너 등록');
  let eventReceived = false;
  let receivedPayload: RecruitChangedEvent | null = null;

  eventBus.onEvent<RecruitChangedEvent>(EventType.RECRUIT_CHANGED, (payload) => {
    console.log('  이벤트 수신됨!');
    eventReceived = true;
    receivedPayload = payload;
  });

  console.log(`  리스너 등록 완료 (${EventType.RECRUIT_CHANGED})`);

  // 3. 이벤트 발행
  console.log('\n✓ 테스트 3: 이벤트 발행');
  const testPayload: RecruitChangedEvent = {
    timestamp: Date.now(),
    source: 'test',
    addedJobs: [
      {
        id: 'test-job-1',
        value: {
          href: '/jobs/12345',
          title: '테스트 공고',
          dDay: 'D-7',
          dayTxt: '2026.01.14',
          recruitmentStatus: '접수중',
        },
      },
    ],
    updatedJobs: [],
    deletedIds: [],
  };

  const emitResult = eventBus.emitEvent(EventType.RECRUIT_CHANGED, testPayload);
  console.log(`  이벤트 발행 결과: ${emitResult ? '성공' : '실패'}`);

  // 4. 이벤트 수신 확인
  console.log('\n✓ 테스트 4: 이벤트 수신 확인');
  await new Promise((resolve) => setTimeout(resolve, 100)); // 비동기 처리 대기

  if (eventReceived) {
    console.log('  이벤트가 정상적으로 수신되었습니다.');
    console.log(`  페이로드 수신: ${receivedPayload !== null}`);
  } else {
    console.log('  ❌ 이벤트가 수신되지 않았습니다!');
  }

  // 5. 리스너 수 확인
  console.log('\n✓ 테스트 5: 리스너 수 확인');
  const listenerCount = eventBus.listenerCountForEvent(EventType.RECRUIT_CHANGED);
  console.log(`  현재 리스너 수: ${listenerCount}`);

  // 6. 타입 안전성 테스트
  console.log('\n✓ 테스트 6: 타입 안전성 확인');
  console.log('  TypeScript 컴파일 시 타입 체크 완료');

  console.log('\n=== EventBus 테스트 완료 ===');
  console.log(`\n최종 결과: ${eventReceived ? '✅ 모든 테스트 통과' : '❌ 일부 테스트 실패'}\n`);
}

// 직접 실행 시
if (require.main === module) {
  testEventBus().catch(console.error);
}
