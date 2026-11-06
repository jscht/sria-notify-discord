import type { DisplayField, EliasRecruit, RecruitmentStatus } from "@/common/types";
import { toKorean } from "@/common/utils/cityName";
import type { EliasField, EliasValue } from "./eliasFields";
import type { EliasTitle } from "./eliasTitles";

/**
 * elias 규칙 엔진 — stateless 결정적 시뮬레이션. (Phase 1.10)
 *
 * 시각 `now`의 공고 세계 = `now`의 순수 함수. serverless(상태 비저장)에서도
 * diff 엔진이 직전 저장분과 비교해 규칙대로 added/updated/deleted를 발화시킨다.
 * 난수는 전부 시드 PRNG(문자열→[0,1)) — Math.random/외부 상태 미사용.
 */
export interface EliasRuleConfig {
  /** 경계 간격(ms). 시간 한 칸(틱). */
  unitMs: number;
  /** 모집기간(틱 수). 실제 시간 = unitMs × lifespanTicks. */
  lifespanTicks: number;
  /** 한 경계에서 생성 개수 확률. */
  spawnProbs: { 1: number; 2: number; 3: number };
  /** 접수중이 종료로 바뀌는 확률(0~1). 제거 확률과 따로 계산한다. */
  closeProb: number;
  /** 공고가 목록에서 빠지는 확률(0~1). */
  deleteProb: number;
  /** 공고 목록(지역·제목·게시자). */
  titles: EliasTitle[];
  /** 추가 속성 규칙. */
  fields: EliasField[];
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
function spawnCount(s: number, probs: EliasRuleConfig["spawnProbs"]): number {
  const r = rand("spawn", s);
  if (r < probs[1]) return 1;
  if (r < probs[1] + probs[2]) return 2;
  if (r < probs[1] + probs[2] + probs[3]) return 3;
  return 0;
}

/**
 * (born, born+lifespan) 중 처음으로 확률에 걸린 tick. 없으면 null.
 * born 당일은 제외 — 공고는 최소 한 경계는 노출된다(스폰 즉시 소멸 방지).
 * 제거("del")와 종료("close")는 난수 이름이 달라 서로 영향을 주지 않는다.
 */
function firstHitTick(
  id: string,
  kind: "del" | "close",
  born: number,
  lifespan: number,
  prob: number
): number | null {
  for (let u = born + 1; u < born + lifespan; u++) {
    if (rand(id, kind, u) < prob) return u;
  }
  return null;
}

const KST_OFFSET_MS = 9 * 60 * 60_000;

/**
 * epoch ms → `"YYYY.MM.DD HH:mm"` (한국 시간).
 * 배포된 함수는 UTC, 로컬은 한국 시간으로 돌기 때문에 `getUTC*` + 9시간으로 계산해
 * 서버 시간대와 상관없이 같은 글자를 만든다.
 */
function formatKst(ms: number): string {
  const d = new Date(ms + KST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function resolveValue(v: EliasValue, id: string, key: string): unknown {
  if (v.kind === "fixed") return v.value;
  if (!v.pool.length) return undefined;
  return v.pool[Math.floor(rand(id, "val", key) * v.pool.length)];
}

/**
 * 시각 `now`에 살아있는 elias 공고 목록을 결정적으로 산출한다.
 */
export function generateEliasRecruits(now: number, cfg: EliasRuleConfig): EliasRecruit[] {
  const t = Math.floor(now / cfg.unitMs);
  const lifespan = cfg.lifespanTicks;
  const out: EliasRecruit[] = [];

  // 후보 = [t-lifespan, t] 경계에서 스폰된 공고(유계 순회).
  for (let s = Math.max(0, t - lifespan); s <= t; s++) {
    const n = spawnCount(s, cfg.spawnProbs);
    const used = new Set<number>(); // 이 회차에서 고른 줄

    for (let idx = 0; idx < n; idx++) {
      const id = `elias:${s}-${idx}`;

      // ⚠️ 줄 선택은 제거·만료 판정보다 먼저 한다.
      //    판정 뒤에 고르면, 앞 공고가 제거된 회차부터 뒤 공고의 줄이 바뀌어
      //    "변경됨"으로 잡힌다.
      if (used.size >= cfg.titles.length) break; // 줄을 다 썼으면 이 회차는 더 만들지 않는다
      let titleIdx = Math.floor(rand(id, "title") * cfg.titles.length);
      while (used.has(titleIdx)) titleIdx = (titleIdx + 1) % cfg.titles.length;
      used.add(titleIdx);

      // 모집 기간 끝: 목록에서 빠진다.
      if (t >= s + lifespan) continue;
      // 제거: 처음 걸린 시점부터 목록에서 빠진다.
      const removedAt = firstHitTick(id, "del", s, lifespan, cfg.deleteProb);
      if (removedAt !== null && t >= removedAt) continue;
      // 종료: 처음 걸린 시점부터 모집 기간 끝까지 "종료"로 남는다.
      const closedAt = firstHitTick(id, "close", s, lifespan, cfg.closeProb);
      const status: RecruitmentStatus = closedAt !== null && t >= closedAt ? "종료" : "접수중";

      const pick = cfg.titles[titleIdx];
      const title = `[${toKorean(pick.region)}] ${pick.title}`;

      // 사용자 정의 속성(eliasFields): 포함(무조건/확률) + 값(고정/풀 랜덤).
      const fields: DisplayField[] = [];
      for (const f of cfg.fields) {
        const include = f.required || rand(id, "field", f.key) < (f.chance ?? 0);
        if (!include) continue;
        const v = resolveValue(f.value, id, f.key);
        if (v !== undefined) fields.push({ name: f.key, value: String(v) });
      }

      out.push({
        id,
        source: "elias",
        title,
        postedBy: pick.postedBy,
        period: `${formatKst(s * cfg.unitMs)} ~ ${formatKst((s + lifespan) * cfg.unitMs)}`,
        status,
        ...(fields.length ? { fields } : {}),
      });
    }
  }

  return out;
}
