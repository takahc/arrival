// Unit tests for lib/schedule.ts.
// Run with: npx tsx --test lib/schedule.test.ts
// (or via `npm test` after a build that emits JS; we run from tsx here.)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  buildAdvice,
  formatDurationMin,
  formatHHMM,
  parseTimeOnDate,
  upcomingTrains,
  type Settings,
} from "./schedule";

function at(h: number, m: number): Date {
  // Fix the date so tests are deterministic.
  const d = new Date(2030, 0, 15, h, m, 0, 0);
  return d;
}

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    destinationName: "Office",
    walkToStationMin: 10,
    rideTimeMin: 20,
    walkFromStationMin: 5,
    bufferMin: 1,
    trainDepartures: ["08:00", "08:15", "08:30", "08:45"],
    ...overrides,
  };
}

test("formatHHMM zero-pads", () => {
  assert.equal(formatHHMM(at(8, 5)), "08:05");
  assert.equal(formatHHMM(at(23, 59)), "23:59");
});

test("formatDurationMin handles sign and hours", () => {
  assert.equal(formatDurationMin(0), "0分");
  assert.equal(formatDurationMin(5), "5分");
  assert.equal(formatDurationMin(60), "1時間");
  assert.equal(formatDurationMin(75), "1時間15分");
  assert.equal(formatDurationMin(-7), "-7分");
});

test("parseTimeOnDate rejects invalid input", () => {
  const anchor = at(12, 0);
  assert.equal(parseTimeOnDate("25:00", anchor), null);
  assert.equal(parseTimeOnDate("abc", anchor), null);
  assert.equal(parseTimeOnDate("", anchor), null);
  const good = parseTimeOnDate("07:30", anchor);
  assert.ok(good);
  assert.equal(formatHHMM(good!), "07:30");
});

test("upcomingTrains filters to catchable trains (needs walkToStationMin)", () => {
  const now = at(7, 55); // walk 10min → can catch 08:15 but not 08:00 (needs to have left at 07:50)
  const ups = upcomingTrains(now, settings());
  assert.equal(ups.length, 3);
  assert.equal(formatHHMM(ups[0].departure), "08:15");
  assert.equal(formatHHMM(ups[0].arrival), "08:40"); // 08:15 + 20 + 5
  assert.equal(formatHHMM(ups[0].latestLeaveBy), "08:05");
  assert.equal(formatHHMM(ups[0].recommendedLeaveBy), "08:04"); // 1min buffer
});

test("upcomingTrains rolls over to tomorrow when today's trains are all past", () => {
  const now = at(23, 30);
  const ups = upcomingTrains(now, settings());
  assert.equal(ups.length, 4);
  // Still 08:00 etc., but on the next calendar day.
  assert.equal(formatHHMM(ups[0].departure), "08:00");
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.equal(ups[0].departure.getDate(), tomorrow.getDate());
});

test("buildAdvice: urgent when leave-by is within buffer", () => {
  const now = at(8, 4); // latestLeaveBy for 08:15 is 08:05; within 1min buffer
  const ups = upcomingTrains(now, settings());
  const advice = buildAdvice(now, ups, settings());
  assert.equal(advice.level, "urgent");
  assert.match(advice.message, /今すぐ出た/);
});

test("buildAdvice: ok with detail when there is plenty of time", () => {
  const now = at(7, 30);
  const ups = upcomingTrains(now, settings());
  const advice = buildAdvice(now, ups, settings());
  assert.equal(advice.level, "ok");
});

test("buildAdvice: late message when no trains remain at all", () => {
  const now = at(8, 0);
  const advice = buildAdvice(now, [], settings());
  assert.equal(advice.level, "late");
});

test("buildAdvice: with target — next-next still makes it ⇒ ok", () => {
  // Target 09:10. Next train 08:15 arrives 08:40; next-next 08:30 arrives 08:55.
  const now = at(7, 45);
  const s = settings({ targetArrivalTime: "09:10" });
  const ups = upcomingTrains(now, s);
  const advice = buildAdvice(now, ups, s);
  assert.equal(advice.level, "ok");
  assert.match(advice.message, /急がなくても/);
});

test("buildAdvice: with target — next-next is clearly late ⇒ soon warning", () => {
  // now=07:55 so 08:00 is no longer catchable. Next 08:15 arr 08:40, next-next 08:30 arr 08:55.
  // Target 08:42 → earlyMin = 2, nextNextEarlyMin = -13.
  const now = at(7, 55);
  const s = settings({ targetArrivalTime: "08:42" });
  const ups = upcomingTrains(now, s);
  const advice = buildAdvice(now, ups, s);
  assert.equal(advice.level, "soon");
  assert.match(advice.message, /次を逃すと/);
});

test("buildAdvice: with target — next-next marginally late ⇒ ギリギリ", () => {
  // now=07:55. Next arr 08:40, next-next arr 08:55. Target 08:54 → nextNextEarlyMin=-1.
  const now = at(7, 55);
  const s = settings({ targetArrivalTime: "08:54" });
  const ups = upcomingTrains(now, s);
  const advice = buildAdvice(now, ups, s);
  assert.equal(advice.level, "soon");
  assert.match(advice.message, /ギリギリ/);
});
