import type { TempRecruit } from "@/common/types";
import type { TempField, TempValue } from "./tempFields";

/**
 * temp 규칙 엔진 — stateless 결정적 시뮬레이션. (Phase 1.10)
 *
 * 시각 `now`의 공고 세계 = `now`의 순수 함수. serverless(상태 비저장)에서도
 * diff 엔진이 직전 저장분과 비교해 규칙대로 added/updated/deleted를 발화시킨다.
 * 난수는 전부 시드 PRNG(문자열→[0,1)) — Math.random/외부 상태 미사용.
 */
export interface TempRuleConfig {
  /** 경계 간격(ms). 시간 한 칸(틱). */
  unitMs: number;
  /** 모집기간(틱 수). 실제 시간 = unitMs × lifespanTicks. */
  lifespanTicks: number;
  /** 한 경계에서 생성 개수 확률. */
  spawnProbs: { 1: number; 2: number; 3: number };
  /** 내용 확률 수정 확률(0~1). */
  editProb: number;
  /** 확률 삭제(영구) 확률(0~1). */
  deleteProb: number;
  /** 제목 후보(필수 속성 값 풀). */
  titles: string[];
  /** 추가 속성 규칙. */
  fields: TempField[];
}

/** FNV-1a 문자열 해시. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** murmur3 fmix32 finalizer — 32비트 해시를 근사 균등 분포로 마무리. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 시드 PRNG: (parts) → [0,1). 결정적(FNV 시드 + fmix32). */
function rand(...parts: Array<string | number>): number {
  return fmix32(hashStr(parts.join("|"))) / 4294967296;
}

/** 경계 s에서 스폰 개수(누적 확률). */
function spawnCount(s: number, probs: TempRuleConfig["spawnProbs"]): number {
  const r = rand("spawn", s);
  if (r < probs[1]) return 1;
  if (r < probs[1] + probs[2]) return 2;
  if (r < probs[1] + probs[2] + probs[3]) return 3;
  return 0;
}

/**
 * 확률 삭제(영구): (born, born+lifespan) 중 최초로 임계 미만이 되는 tick. 없으면 null.
 * born 당일은 제외 — 공고는 최소 한 경계는 노출된다(스폰 즉시 소멸 방지).
 */
function firstDeathTick(
  id: string,
  born: number,
  lifespan: number,
  deleteProb: number
): number | null {
  for (let u = born + 1; u < born + lifespan; u++) {
    if (rand(id, "del", u) < deleteProb) return u;
  }
  return null;
}

function resolveValue(v: TempValue, id: string, key: string): unknown {
  if (v.kind === "fixed") return v.value;
  if (!v.pool.length) return undefined;
  return v.pool[Math.floor(rand(id, "val", key) * v.pool.length)];
}

/**
 * 시각 `now`에 살아있는 temp 공고 목록을 결정적으로 산출한다.
 */
export function generateTempRecruits(now: number, cfg: TempRuleConfig): TempRecruit[] {
  const t = Math.floor(now / cfg.unitMs);
  const lifespan = cfg.lifespanTicks;
  const out: TempRecruit[] = [];

  // 후보 = [t-lifespan, t] 경계에서 스폰된 공고(유계 순회).
  for (let s = Math.max(0, t - lifespan); s <= t; s++) {
    const n = spawnCount(s, cfg.spawnProbs);
    for (let idx = 0; idx < n; idx++) {
      const id = `temp:${s}-${idx}`;

      // 확정 삭제: 모집기간 종료.
      if (t >= s + lifespan) continue;
      // 확률 삭제(영구): 최초 히트 이후로는 영구히 사라짐.
      const death = firstDeathTick(id, s, lifespan, cfg.deleteProb);
      if (death !== null && t >= death) continue;

      const age = t - s;
      const remaining = lifespan - age; // 남은 틱(>=1)
      const title = cfg.titles.length ?
        String(cfg.titles[Math.floor(rand(id, "title") * cfg.titles.length)]) :
        "무제 공고";

      const posting: TempRecruit = {
        id,
        source: "temp",
        title,
        // 확정 수정(진행도): 경과에 따라 결정적으로 변함 → 매 경계 updated.
        dDay: remaining <= 1 ? "오늘마감" : `D-${remaining - 1}`,
        dayTxt: `모집 ${lifespan}틱 · 경과 ${age}틱`,
        recruitmentStatus: remaining <= 1 ? "발표중" : "접수중",
        url: "",
      };

      // 확률 수정: 특정 경계에서 내용 토글.
      if (rand(id, "edit", t) < cfg.editProb) {
        posting.badge = "급구";
      }

      // 사용자 정의 속성(spec): 포함(무조건/확률) + 값(고정/풀 랜덤).
      for (const f of cfg.fields) {
        const include = f.required || rand(id, "field", f.key) < (f.chance ?? 0);
        if (include) posting[f.key] = resolveValue(f.value, id, f.key);
      }

      out.push(posting);
    }
  }

  return out;
}
