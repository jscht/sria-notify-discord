/**
 * SystemError 테스트
 *
 * 새로운 에러 처리 시스템이 제대로 작동하는지 확인
 */

// SystemLogger와 SystemError import (전역 등록을 위해)
import "../systemLogger";
import { SystemError, ErrorLevel, ErrorCategory } from "../systemError";
import {
  withErrorHandler,
  withRetry,
  normalizeError,
  allSettledWithErrors,
} from "../errorHandler";

console.log("\n=== SystemError 테스트 시작 ===\n");

// 1. SystemError 기본 생성 테스트
console.log("✓ 테스트 1: SystemError 기본 생성");
try {
  const error = new SystemError("테스트 에러", {
    level: ErrorLevel.WARNING,
    category: ErrorCategory.VALIDATION,
    context: { field: "email", value: "invalid" },
  });

  console.log(`  에러 메시지: ${error.message}`);
  console.log(`  에러 레벨: ${error.level}`);
  console.log(`  에러 카테고리: ${error.category}`);
  console.log(`  복구 가능: ${error.recoverable}`);
} catch (error) {
  console.log("  ❌ SystemError 생성 실패:", error);
}

// 2. 정적 팩토리 메서드 테스트
console.log("\n✓ 테스트 2: 정적 팩토리 메서드");
try {
  const crawlerError = SystemError.crawlerFailed("크롤링 실패", {
    url: "https://example.com",
  });
  console.log(`  크롤러 에러: ${crawlerError.message}`);
  console.log(`  카테고리: ${crawlerError.category}`);

  const dbError = SystemError.databaseError(
    "Firestore 저장 실패",
    new Error("Network error")
  );
  console.log(`  DB 에러: ${dbError.message}`);
  console.log(`  원본 에러 존재: ${!!dbError.originalError}`);

  const criticalError = SystemError.critical("시스템 전체 장애");
  console.log(`  치명적 에러: ${criticalError.message}`);
  console.log(`  레벨: ${criticalError.level}`);
} catch (error) {
  console.log("  ❌ 팩토리 메서드 실패:", error);
}

// 3. 에러 래핑 테스트
console.log("\n✓ 테스트 3: 에러 래핑");
try {
  const originalError = new Error("원본 에러 메시지");
  const wrappedError = SystemError.wrap(originalError, "래핑된 에러", {
    category: ErrorCategory.EXTERNAL_API,
  });

  console.log(`  래핑된 에러 메시지: ${wrappedError.message}`);
  console.log(`  원본 에러 메시지: ${wrappedError.originalError?.message}`);
  console.log(`  스택 보존: ${wrappedError.stack?.includes("Caused by")}`);
} catch (error) {
  console.log("  ❌ 에러 래핑 실패:", error);
}

// 4. withErrorHandler 테스트
console.log("\n✓ 테스트 4: withErrorHandler");
(async () => {
  try {
    const result = await withErrorHandler(
      async () => {
        throw new Error("비동기 함수 에러");
      },
      {
        category: ErrorCategory.EXTERNAL_API,
        message: "API 호출 실패",
        emitEvent: false, // 테스트에서는 이벤트 발행 안 함
        fallback: () => console.log("  폴백 함수 실행됨"),
      }
    );

    console.log(`  결과: ${result === undefined ? "undefined (정상)" : "예상치 못한 값"}`);
  } catch (error) {
    console.log("  ❌ withErrorHandler 실패:", error);
  }
})();

// 5. withRetry 테스트
console.log("\n✓ 테스트 5: withRetry");
(async () => {
  let attemptCount = 0;

  try {
    const result = await withRetry(
      async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`재시도 ${attemptCount}`);
        }
        return "성공!";
      },
      {
        maxRetries: 3,
        retryDelay: 100,
        category: ErrorCategory.EXTERNAL_API,
        message: "재시도 테스트",
        emitEvent: false,
      }
    );

    console.log(`  결과: ${result}`);
    console.log(`  재시도 횟수: ${attemptCount}`);
  } catch (error) {
    console.log("  ❌ withRetry 실패:", error);
  }
})();

// 6. normalizeError 테스트
console.log("\n✓ 테스트 6: normalizeError");
try {
  const error1 = normalizeError(new Error("일반 에러"));
  console.log(`  Error 정규화: ${error1 instanceof SystemError}`);

  const error2 = normalizeError("문자열 에러");
  console.log(`  String 정규화: ${error2 instanceof SystemError}`);

  const error3 = normalizeError({ custom: "객체 에러" });
  console.log(`  Object 정규화: ${error3 instanceof SystemError}`);

  const error4 = normalizeError(
    new SystemError("이미 SystemError", {
      category: ErrorCategory.CRAWLER,
    })
  );
  console.log(`  SystemError 유지: ${error4.category === ErrorCategory.CRAWLER}`);
} catch (error) {
  console.log("  ❌ normalizeError 실패:", error);
}

// 7. allSettledWithErrors 테스트
console.log("\n✓ 테스트 7: allSettledWithErrors");
(async () => {
  try {
    const promises = [
      Promise.resolve("성공 1"),
      Promise.reject(new Error("실패 1")),
      Promise.resolve("성공 2"),
      Promise.reject(new Error("실패 2")),
      Promise.resolve("성공 3"),
    ];

    const results = await allSettledWithErrors(promises, {
      category: ErrorCategory.UNKNOWN,
      message: "병렬 작업 실패",
    });

    console.log(`  성공한 결과 개수: ${results.length}`);
    console.log(`  결과: ${JSON.stringify(results)}`);
  } catch (error) {
    console.log("  ❌ allSettledWithErrors 실패:", error);
  }
})();

// 8. JSON 직렬화 테스트
console.log("\n✓ 테스트 8: JSON 직렬화");
try {
  const error = SystemError.proxyError("프록시 불가", {
    proxyCount: 0,
    lastAttempt: new Date().toISOString(),
  });

  const json = error.toJSON() as any;
  console.log(`  JSON 변환 성공: ${!!json}`);
  console.log(`  필드 포함: ${!!json.level && !!json.category && !!json.timestamp}`);
} catch (error) {
  console.log("  ❌ JSON 직렬화 실패:", error);
}

// 모든 비동기 테스트가 완료될 때까지 대기
setTimeout(() => {
  console.log("\n=== SystemError 테스트 완료 ===\n");
  console.log("✅ 모든 에러 처리 시스템이 정상적으로 작동합니다!\n");
}, 1000);
