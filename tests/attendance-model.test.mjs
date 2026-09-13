import assert from "node:assert/strict";
import test from "node:test";
import { applyHolidayRanges } from "../src/content/dashboard/attendance-model.js";

function dataset() {
  return {
    lessons: [],
    weeks: [
      { studentKey: "1001", weekStart: "2026-08-07", weekEnd: "2026-08-13", attended: 0, status: "缺勤" },
      { studentKey: "1001", weekStart: "2026-08-14", weekEnd: "2026-08-20", attended: 1, status: "出勤" },
      { studentKey: "1001", weekStart: "2026-08-21", weekEnd: "2026-08-27", attended: 1, status: "出勤" },
    ],
    summaries: [{
      studentKey: "1001",
      expectedWeeks: 3,
      attendedWeeks: 2,
      absentWeeks: 1,
      attendanceRate: 2 / 3,
      currentStreak: 2,
      longestStreak: 2,
    }],
  };
}

test("假期排除无上课记录的教学周并重算出勤率", () => {
  const result = applyHolidayRanges(dataset(), [{
    id: "summer",
    name: "暑假",
    start: "2026-08-08",
    end: "2026-08-10",
  }]);

  assert.equal(result.weeks[0].status, "放假");
  assert.equal(result.weeks[0].holidayName, "暑假");
  assert.equal(result.summaries[0].expectedWeeks, 2);
  assert.equal(result.summaries[0].absentWeeks, 0);
  assert.equal(result.summaries[0].attendanceRate, 1);
  assert.equal(result.summaries[0].excludedWeeks, 1);
});

test("放假区间内已上课的教学周仍计为出勤", () => {
  const result = applyHolidayRanges(dataset(), [{
    id: "lesson-week",
    name: "测试假期",
    start: "2026-08-15",
    end: "2026-08-16",
  }]);

  assert.equal(result.weeks[1].status, "出勤");
  assert.equal(result.weeks[1].excluded, 0);
  assert.equal(result.summaries[0].expectedWeeks, 3);
  assert.equal(result.summaries[0].attendedWeeks, 2);
});

test("重叠假期不会重复排除同一教学周", () => {
  const result = applyHolidayRanges(dataset(), [
    { id: "a", name: "假期 A", start: "2026-08-07", end: "2026-08-09" },
    { id: "b", name: "假期 B", start: "2026-08-09", end: "2026-08-13" },
  ]);

  assert.equal(result.summaries[0].excludedWeeks, 1);
  assert.equal(result.weeks[0].holidayName, "假期 A、假期 B");
});
