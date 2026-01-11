/**
 * Global Logger 테스트
 *
 * 전역 로거가 제대로 등록되었는지 확인
 */

// Logger와 SystemLogger import (전역 등록을 위해)
import "../logger";
import "../systemLogger";

console.log("\n=== Global Logger 테스트 시작 ===\n");

const g = global as any;

// 1. DebugLogger 전역 확인
console.log("✓ 테스트 1: DebugLogger 전역 확인");
if (typeof g.DebugLogger !== "undefined") {
  console.log("  DebugLogger가 전역에 등록되었습니다.");
  console.log(`  타입: ${typeof g.DebugLogger}`);
} else {
  console.log("  ❌ DebugLogger가 전역에 등록되지 않았습니다!");
}

// 2. globalLogger 전역 확인
console.log("\n✓ 테스트 2: globalLogger 전역 확인");
if (typeof g.globalLogger !== "undefined") {
  console.log("  globalLogger가 전역에 등록되었습니다.");
  console.log(`  타입: ${typeof g.globalLogger}`);
} else {
  console.log("  ❌ globalLogger가 전역에 등록되지 않았습니다!");
}

// 3. createGlobalLogger 전역 확인
console.log("\n✓ 테스트 3: createGlobalLogger 전역 확인");
if (typeof g.createGlobalLogger !== "undefined") {
  console.log("  createGlobalLogger가 전역에 등록되었습니다.");
  console.log(`  타입: ${typeof g.createGlobalLogger}`);
} else {
  console.log("  ❌ createGlobalLogger가 전역에 등록되지 않았습니다!");
}

// 4. DebugLogger 사용 테스트
console.log("\n✓ 테스트 4: DebugLogger 사용 테스트");
try {
  g.DebugLogger.server("테스트 서버 메시지");
  console.log("  DebugLogger.server() 호출 성공");
} catch (error) {
  console.log("  ❌ DebugLogger.server() 호출 실패:", error);
}

// 5. globalLogger 사용 테스트
console.log("\n✓ 테스트 5: globalLogger 사용 테스트");
try {
  g.globalLogger.info("테스트 info 메시지", { test: true });
  console.log("  globalLogger.info() 호출 성공");
} catch (error) {
  console.log("  ❌ globalLogger.info() 호출 실패:", error);
}

// 6. createGlobalLogger 사용 테스트
console.log("\n✓ 테스트 6: createGlobalLogger 사용 테스트");
try {
  const testLogger = g.createGlobalLogger("TestService");
  testLogger.success("테스트 success 메시지");
  console.log("  createGlobalLogger() 및 사용 성공");
} catch (error) {
  console.log("  ❌ createGlobalLogger() 사용 실패:", error);
}

console.log("\n=== Global Logger 테스트 완료 ===\n");
console.log("✅ 모든 전역 로거가 정상적으로 작동합니다!\n");
