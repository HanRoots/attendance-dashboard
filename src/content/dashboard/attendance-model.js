const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export const REQUIRED_LESSON_HEADERS = [
  "消课日期",
  "学号",
  "姓名",
  "班级编号",
  "班级",
  "原课时",
  "消课时",
  "现课时",
];

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function normalizeExcelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return isoDate(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    return isoDate(new Date(Date.UTC(1899, 11, 30) + Math.round(value) * MS_PER_DAY));
  }
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/u);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function teachingWeekStart(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  const daysSinceFriday = (date.getUTCDay() + 2) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceFriday);
  return isoDate(date);
}

function toNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateRecords(records) {
  if (!Array.isArray(records) || !records.length) throw new Error("“消课记录”中没有可统计的数据行");
  const headers = new Set(Object.keys(records[0] ?? {}));
  const missing = REQUIRED_LESSON_HEADERS.filter((header) => !headers.has(header));
  if (missing.length) throw new Error(`工作表缺少必需列：${missing.join("、")}`);
}

export function buildAttendanceDataset(records) {
  validateRecords(records);
  const lessons = records.map((row, index) => {
    const date = normalizeExcelDate(row["消课日期"]);
    if (!date) throw new Error(`消课记录第 ${index + 2} 行的日期无法识别`);
    const weekStart = teachingWeekStart(date);
    return {
      recordId: `${row["学号"]}-${date}-${String(index + 1).padStart(3, "0")}`,
      date,
      weekStart,
      weekEnd: addDays(weekStart, 6),
      studentId: String(row["学号"] ?? ""),
      studentName: String(row["姓名"] ?? ""),
      classId: String(row["班级编号"] ?? ""),
      className: String(row["班级"] ?? ""),
      beforeHours: toNumber(row["原课时"]),
      consumedHours: toNumber(row["消课时"]) ?? 0,
      afterHours: toNumber(row["现课时"]),
    };
  }).sort((left, right) => left.date.localeCompare(right.date) || left.recordId.localeCompare(right.recordId));

  const groupedStudents = new Map();
  for (const lesson of lessons) {
    const studentKey = lesson.studentId || lesson.studentName;
    if (!groupedStudents.has(studentKey)) groupedStudents.set(studentKey, []);
    groupedStudents.get(studentKey).push(lesson);
  }

  const weeks = [];
  const summaries = [];
  for (const [studentKey, studentLessons] of groupedStudents) {
    const firstWeek = studentLessons[0].weekStart;
    const lastWeek = studentLessons.at(-1).weekStart;
    const lessonsByWeek = new Map();
    for (const lesson of studentLessons) {
      if (!lessonsByWeek.has(lesson.weekStart)) lessonsByWeek.set(lesson.weekStart, []);
      lessonsByWeek.get(lesson.weekStart).push(lesson);
    }

    const expectedWeeks = Math.round(
      (new Date(`${lastWeek}T00:00:00Z`) - new Date(`${firstWeek}T00:00:00Z`)) / MS_PER_WEEK,
    ) + 1;
    const studentWeeks = Array.from({ length: expectedWeeks }, (_, index) => {
      const weekStart = addDays(firstWeek, index * 7);
      const weekLessons = lessonsByWeek.get(weekStart) ?? [];
      const latestLesson = weekLessons.at(-1);
      return {
        studentKey,
        studentId: studentLessons[0].studentId,
        studentName: studentLessons[0].studentName,
        weekStart,
        weekEnd: addDays(weekStart, 6),
        attended: weekLessons.length ? 1 : 0,
        status: weekLessons.length ? "出勤" : "缺勤",
        lessonDate: weekLessons[0]?.date ?? null,
        lessonDates: weekLessons.map((lesson) => lesson.date).join("、"),
        lessonCount: weekLessons.length,
        consumedHours: weekLessons.reduce((sum, lesson) => sum + lesson.consumedHours, 0),
        className: latestLesson?.className ?? null,
      };
    });

    let currentStreak = 0;
    for (let index = studentWeeks.length - 1; index >= 0 && studentWeeks[index].attended; index -= 1) currentStreak += 1;
    let longestStreak = 0;
    let runningStreak = 0;
    for (const week of studentWeeks) {
      runningStreak = week.attended ? runningStreak + 1 : 0;
      longestStreak = Math.max(longestStreak, runningStreak);
    }
    const attendedWeeks = studentWeeks.filter((week) => week.attended).length;
    summaries.push({
      studentKey,
      studentId: studentLessons[0].studentId,
      studentName: studentLessons[0].studentName,
      firstLessonDate: studentLessons[0].date,
      lastLessonDate: studentLessons.at(-1).date,
      firstWeek,
      lastWeek,
      lastWeekEnd: addDays(lastWeek, 6),
      expectedWeeks,
      attendedWeeks,
      absentWeeks: expectedWeeks - attendedWeeks,
      attendanceRate: attendedWeeks / expectedWeeks,
      lessonRecords: studentLessons.length,
      consumedHours: studentLessons.reduce((sum, lesson) => sum + lesson.consumedHours, 0),
      currentStreak,
      longestStreak,
      currentBalance: studentLessons.at(-1).afterHours,
    });
    weeks.push(...studentWeeks);
  }

  return { lessons, weeks, summaries };
}

export function applyHolidayRanges(dataset, holidayRanges = []) {
  const ranges = holidayRanges
    .filter((range) => range?.start && range?.end && range.start <= range.end)
    .map((range) => ({ ...range, name: String(range.name || "放假").trim() || "放假" }));
  if (!ranges.length) {
    return {
      ...dataset,
      weeks: dataset.weeks.map((week) => ({ ...week, excluded: 0, holidayName: null })),
      summaries: dataset.summaries.map((summary) => ({ ...summary, excludedWeeks: 0 })),
    };
  }

  const weeks = dataset.weeks.map((week) => {
    const matchingRanges = ranges.filter((range) => range.start <= week.weekEnd && range.end >= week.weekStart);
    const excluded = !week.attended && matchingRanges.length > 0;
    return {
      ...week,
      excluded: excluded ? 1 : 0,
      status: excluded ? "放假" : week.attended ? "出勤" : "缺勤",
      holidayName: matchingRanges.length
        ? [...new Set(matchingRanges.map((range) => range.name))].join("、")
        : null,
    };
  });

  const summaries = dataset.summaries.map((summary) => {
    const studentWeeks = weeks.filter((week) => week.studentKey === summary.studentKey);
    const eligibleWeeks = studentWeeks.filter((week) => !week.excluded);
    const attendedWeeks = eligibleWeeks.filter((week) => week.attended).length;
    const expectedWeeks = eligibleWeeks.length;
    let currentStreak = 0;
    for (let index = eligibleWeeks.length - 1; index >= 0 && eligibleWeeks[index].attended; index -= 1) currentStreak += 1;
    let longestStreak = 0;
    let runningStreak = 0;
    for (const week of eligibleWeeks) {
      runningStreak = week.attended ? runningStreak + 1 : 0;
      longestStreak = Math.max(longestStreak, runningStreak);
    }
    return {
      ...summary,
      expectedWeeks,
      attendedWeeks,
      absentWeeks: expectedWeeks - attendedWeeks,
      attendanceRate: expectedWeeks ? attendedWeeks / expectedWeeks : null,
      excludedWeeks: studentWeeks.filter((week) => week.excluded).length,
      currentStreak,
      longestStreak,
    };
  });

  return { ...dataset, weeks, summaries };
}

export function formatChineseDate(dateValue) {
  if (!dateValue) return "—";
  const [year, month, day] = dateValue.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export function formatMonth(dateValue) {
  const [year, month] = dateValue.split("-").map(Number);
  return `${year}年${month}月`;
}

export function formatWeekRange(weekStart, weekEnd) {
  const compact = (dateValue) => dateValue.slice(5).replace("-", "/");
  return `${compact(weekStart)}—${compact(weekEnd)}`;
}

export function monthShift(yearMonth, amount) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return isoDate(date).slice(0, 7);
}

export function calendarDates(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(date.getUTCDate() + index);
    return isoDate(date);
  });
}
