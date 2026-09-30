/**
 * BaseScheduler Event Emit Test
 *
 * Phase 1.2 Completion Criteria:
 * - RECRUIT_SYNC_STARTED event on scheduler start
 * - RECRUIT_SYNC_COMPLETED event on work success
 * - RECRUIT_SYNC_FAILED event on work failure
 */

// Register global logger (for test)
import "@/common/utils/systemLogger";

import { BaseScheduler } from "../base/BaseScheduler";
import {
  eventBus,
  EventType,
  RecruitSyncStartedEvent,
  RecruitSyncCompletedEvent,
  RecruitSyncFailedEvent,
} from "@/events/bus";
import { SchedulerConfig, WorkResult } from "../types";

/**
 * Test scheduler for success case
 */
class SuccessScheduler extends BaseScheduler {
  constructor() {
    const config: SchedulerConfig = {
      name: "SuccessScheduler",
      workIntervalMs: 1000,
      logIntervalMs: 500,
    };
    super(config);
  }

  protected async performWork(): Promise<WorkResult> {
    const startTime = new Date();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const endTime = new Date();

    return {
      success: true,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      message: "Test work completed",
      totalCount: 10,
    };
  }
}

/**
 * Test scheduler for failure case
 */
class FailScheduler extends BaseScheduler {
  constructor() {
    const config: SchedulerConfig = {
      name: "FailScheduler",
      workIntervalMs: 1000,
      logIntervalMs: 500,
    };
    super(config);
  }

  protected async performWork(): Promise<WorkResult> {
    throw new Error("Intentional test error");
  }
}

/**
 * Run tests
 */
export async function testBaseSchedulerEvents(): Promise<void> {
  console.log("=== BaseScheduler Event Emit Test Start ===\n");

  // Event received storage
  const events: {
    started: RecruitSyncStartedEvent | null;
    completed: RecruitSyncCompletedEvent | null;
    failed: RecruitSyncFailedEvent | null;
  } = {
    started: null,
    completed: null,
    failed: null,
  };

  // 1. Register event listeners
  console.log("Test 1: Register event listeners");

  eventBus.onEvent<RecruitSyncStartedEvent>(
    EventType.RECRUIT_SYNC_STARTED,
    (payload) => {
      console.log("  STARTED event received:", payload.schedulerName);
      events.started = payload;
    }
  );

  eventBus.onEvent<RecruitSyncCompletedEvent>(
    EventType.RECRUIT_SYNC_COMPLETED,
    (payload) => {
      console.log("  COMPLETED event received:", payload.schedulerName);
      events.completed = payload;
    }
  );

  eventBus.onEvent<RecruitSyncFailedEvent>(
    EventType.RECRUIT_SYNC_FAILED,
    (payload) => {
      console.log("  FAILED event received:", payload.schedulerName);
      events.failed = payload;
    }
  );

  console.log("  Listeners registered\n");

  // 2. Success scheduler test
  console.log("Test 2: Success scheduler event emit");
  const successScheduler = new SuccessScheduler();
  successScheduler.startWork();

  await new Promise((resolve) => setTimeout(resolve, 200));
  successScheduler.stopWork();

  if (events.started && events.started.schedulerName === "SuccessScheduler") {
    console.log("  PASS: STARTED event emitted");
    console.log(`     - timestamp: ${events.started.timestamp}`);
    console.log(`     - schedulerName: ${events.started.schedulerName}`);
  } else {
    console.log("  FAIL: STARTED event emit failed");
  }

  if (events.completed && events.completed.schedulerName === "SuccessScheduler") {
    console.log("  PASS: COMPLETED event emitted");
    console.log(`     - totalCount: ${events.completed.totalCount}`);
    console.log(`     - duration: ${events.completed.duration}ms`);
  } else {
    console.log("  FAIL: COMPLETED event emit failed");
  }

  // Payload structure validation (Test 4)
  console.log("\nTest 4: Payload structure validation");
  if (events.completed) {
    const evt = events.completed;
    const hasValidStructure =
      typeof evt.timestamp === "number" &&
      typeof evt.schedulerName === "string" &&
      typeof evt.totalCount === "number" &&
      typeof evt.duration === "number";

    if (hasValidStructure) {
      console.log("  PASS: COMPLETED event payload structure valid");
    } else {
      console.log("  FAIL: COMPLETED event payload structure invalid");
    }
  } else {
    console.log("  FAIL: COMPLETED event payload structure invalid (no event)");
  }

  // 3. Fail scheduler test
  console.log("\nTest 3: Fail scheduler event emit");

  // Reset for fail test
  const failEvents: {
    started: RecruitSyncStartedEvent | null;
    failed: RecruitSyncFailedEvent | null;
  } = { started: null, failed: null };

  eventBus.onEvent<RecruitSyncStartedEvent>(
    EventType.RECRUIT_SYNC_STARTED,
    (payload) => { failEvents.started = payload; }
  );
  eventBus.onEvent<RecruitSyncFailedEvent>(
    EventType.RECRUIT_SYNC_FAILED,
    (payload) => { failEvents.failed = payload; }
  );

  const failScheduler = new FailScheduler();
  failScheduler.startWork();

  await new Promise((resolve) => setTimeout(resolve, 200));
  failScheduler.stopWork();

  if (failEvents.started && failEvents.started.schedulerName === "FailScheduler") {
    console.log("  PASS: STARTED event emitted");
  } else {
    console.log("  FAIL: STARTED event emit failed");
  }

  if (failEvents.failed && failEvents.failed.schedulerName === "FailScheduler") {
    console.log("  PASS: FAILED event emitted");
    console.log(`     - error: ${failEvents.failed.error.message}`);
    console.log(`     - duration: ${failEvents.failed.duration}ms`);
  } else {
    console.log("  FAIL: FAILED event emit failed");
  }

  // Cleanup listeners
  eventBus.removeAllListenersForEvent(EventType.RECRUIT_SYNC_STARTED);
  eventBus.removeAllListenersForEvent(EventType.RECRUIT_SYNC_COMPLETED);
  eventBus.removeAllListenersForEvent(EventType.RECRUIT_SYNC_FAILED);

  console.log("\n=== BaseScheduler Event Emit Test Complete ===\n");
}

// Direct execution
if (require.main === module) {
  testBaseSchedulerEvents().catch(console.error);
}
