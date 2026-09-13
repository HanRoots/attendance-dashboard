import React from "react";
import {
  calendarDates,
  formatMonth,
  formatWeekRange,
  monthShift,
  teachingWeekStart,
} from "./attendance-model.js";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function weekTone(week) {
  if (week.excluded) return "holiday";
  return week.attended ? "attended" : "absent";
}

function ChevronIcon({ direction }) {
  const path = direction === "left" ? "m14.5 6-6 6 6 6" : "m9.5 6 6 6-6 6";
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function MonthNavigator({ month, minMonth, maxMonth, onChange }) {
  const previous = monthShift(month, -1);
  const next = monthShift(month, 1);
  return <div className="month-navigation" aria-label="日历月份">
    <button type="button" className="icon-button" aria-label="上一个月" disabled={previous < minMonth}
      onClick={() => onChange(previous)}><ChevronIcon direction="left" /></button>
    <strong>{formatMonth(month)}</strong>
    <button type="button" className="icon-button" aria-label="下一个月" disabled={next > maxMonth}
      onClick={() => onChange(next)}><ChevronIcon direction="right" /></button>
  </div>;
}

function YearNavigator({ year, minYear, maxYear, onChange }) {
  return <div className="month-navigation year-navigation" aria-label="年度">
    <button type="button" className="icon-button" aria-label="上一年" disabled={year <= minYear}
      onClick={() => onChange(year - 1)}><ChevronIcon direction="left" /></button>
    <strong>{year}年</strong>
    <button type="button" className="icon-button" aria-label="下一年" disabled={year >= maxYear}
      onClick={() => onChange(year + 1)}><ChevronIcon direction="right" /></button>
  </div>;
}

export function CalendarHeaderControls({
  view,
  onViewChange,
  month,
  minMonth,
  maxMonth,
  onMonthChange,
  year,
  minYear,
  maxYear,
  onYearChange,
}) {
  return <div className="calendar-header-controls">
    <div className="calendar-view-toggle" role="group" aria-label="日历视图">
      <button type="button" aria-pressed={view === "month"}
        onClick={() => onViewChange("month")}>月视图</button>
      <button type="button" aria-pressed={view === "year"}
        onClick={() => onViewChange("year")}>年视图</button>
    </div>
    {view === "year"
      ? <YearNavigator year={year} minYear={minYear} maxYear={maxYear} onChange={onYearChange} />
      : <MonthNavigator month={month} minMonth={minMonth} maxMonth={maxMonth} onChange={onMonthChange} />}
  </div>;
}

export function AttendanceCalendar({ month, weeks, lessons, selectedWeek, onSelectWeek }) {
  const weekByStart = new Map(weeks.map((week) => [week.weekStart, week]));
  const lessonDates = new Set(lessons.map((lesson) => lesson.date));
  const dates = calendarDates(month);

  return <div className="calendar-content">
    <div className="calendar-legend" aria-label="日历图例">
      <span><i data-tone="attended" />出勤</span>
      <span><i data-tone="absent" />缺勤</span>
      <span><i data-tone="holiday" />放假</span>
      <span><i data-tone="outside" />未纳入统计</span>
      <span className="calendar-rule">教学周从周五开始</span>
    </div>
    <div className="calendar-weekdays" aria-hidden="true">
      {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
    </div>
    <div className="calendar-grid" data-reviewed-rows>
      {dates.map((date) => {
        const weekStart = teachingWeekStart(date);
        const week = weekByStart.get(weekStart);
        const inMonth = date.startsWith(month);
        const isLesson = lessonDates.has(date);
        const selected = selectedWeek === weekStart;
        const tone = week ? weekTone(week) : "outside";
        const label = week
          ? `${date}，${week.status}${week.excluded && week.holidayName ? `，${week.holidayName}` : ""}${isLesson ? "，上课日" : ""}，教学周 ${formatWeekRange(week.weekStart, week.weekEnd)}`
          : `${date}，未纳入统计`;
        return <button type="button" key={date} className="calendar-day" data-tone={tone}
          data-in-month={inMonth || undefined} data-week-start={date === weekStart || undefined}
          data-selected={selected || undefined} disabled={!week} aria-label={label}
          onClick={() => week && onSelectWeek(week.weekStart)}>
          <span>{Number(date.slice(8))}</span>
          {isLesson && <i className="lesson-dot" aria-hidden="true" />}
        </button>;
      })}
    </div>
  </div>;
}

export function AnnualAttendanceView({ year, weeks, selectedWeek, onSelectWeek }) {
  const eligibleWeeks = weeks.filter((week) => !week.excluded);
  const attendedWeeks = eligibleWeeks.filter((week) => week.attended).length;
  const expectedWeeks = eligibleWeeks.length;
  const absentWeeks = expectedWeeks - attendedWeeks;
  const excludedWeeks = weeks.filter((week) => week.excluded).length;
  const attendanceRate = expectedWeeks ? attendedWeeks / expectedWeeks : null;
  const rateLabel = attendanceRate === null
    ? "—"
    : new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 }).format(attendanceRate);

  return <div className="annual-view">
    <div className="annual-summary" aria-label={`${year}年出勤摘要`}>
      <div className="annual-rate">
        <span>年度出勤率</span>
        <strong>{rateLabel}</strong>
      </div>
      <div className="annual-summary-copy">
        <strong>{expectedWeeks ? `${attendedWeeks} / ${expectedWeeks} 个教学周` : "暂无纳入统计的教学周"}</strong>
        <span>{expectedWeeks
          ? `出勤 ${attendedWeeks} 周 · 缺勤 ${absentWeeks} 周${excludedWeeks ? ` · 放假 ${excludedWeeks} 周` : ""}`
          : excludedWeeks ? `放假 ${excludedWeeks} 周，暂无应统计教学周` : "切换年份查看已有记录"}</span>
      </div>
      <div className="annual-rate-visual" aria-hidden="true">
        <span className="annual-rate-attended" style={{ width: `${attendanceRate ? attendanceRate * 100 : 0}%` }} />
        <span className="annual-rate-absent" style={{ width: `${attendanceRate === null ? 0 : (1 - attendanceRate) * 100}%` }} />
      </div>
    </div>

    <div className="annual-legend" aria-label="年度视图图例">
      <span><i data-tone="attended" />出勤教学周</span>
      <span><i data-tone="absent" />缺勤教学周</span>
      <span><i data-tone="holiday" />放假（不计入）</span>
      <span><i data-tone="outside" />未纳入统计</span>
      <span className="annual-rule">每个色块代表一个周五开始的教学周</span>
    </div>

    <div className="annual-month-grid" data-reviewed-rows>
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const monthValue = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
        const monthWeeks = weeks.filter((week) => week.weekStart.startsWith(monthValue));
        const monthEligible = monthWeeks.filter((week) => !week.excluded);
        const monthAttended = monthEligible.filter((week) => week.attended).length;
        const monthRate = monthEligible.length ? monthAttended / monthEligible.length : null;
        const emptySlots = Math.max(0, 5 - monthWeeks.length);
        return <section className="annual-month-row" key={monthValue} aria-label={`${year}年${monthIndex + 1}月`}>
          <div className="annual-month-label">
            <strong>{monthIndex + 1}月</strong>
            <span>{monthEligible.length ? `${monthAttended}/${monthEligible.length}`
              : monthWeeks.some((week) => week.excluded) ? "放假" : "未纳入"}</span>
          </div>
          <div className="annual-week-cells">
            {monthWeeks.map((week) => <button type="button" key={week.weekStart}
              className="annual-week-cell" data-tone={weekTone(week)}
              data-selected={selectedWeek === week.weekStart || undefined}
              title={`${formatWeekRange(week.weekStart, week.weekEnd)} · ${week.status}`}
              aria-label={`${formatWeekRange(week.weekStart, week.weekEnd)}，${week.status}`}
              onClick={() => onSelectWeek(week)}>
              <span>{Number(week.weekStart.slice(8))}</span>
              <i aria-hidden="true">{week.excluded ? "休" : week.attended ? "✓" : "×"}</i>
            </button>)}
            {Array.from({ length: emptySlots }, (_, index) => <span key={`empty-${index}`}
              className="annual-week-cell annual-week-cell--empty" aria-hidden="true" />)}
          </div>
          <strong className="annual-month-rate">{monthRate === null
            ? "—"
            : new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 0 }).format(monthRate)}</strong>
        </section>;
      })}
    </div>
  </div>;
}

export function WeekDetail({ week }) {
  if (!week) return <div className="week-detail week-detail--empty">选择一个教学周查看详情</div>;
  return <div className="week-detail" data-tone={weekTone(week)}>
    <div>
      <span className="week-detail-label">选中教学周</span>
      <strong>{formatWeekRange(week.weekStart, week.weekEnd)}</strong>
    </div>
    <span className="status-label" data-tone={weekTone(week)}><i />{week.status}</span>
    <div className="week-detail-facts">
      <span>{week.lessonDates ? `${week.lessonDates.replaceAll("-", "/")} 上课`
        : week.excluded ? (week.holidayName || "自定义放假") : "无上课记录"}</span>
      <span>{week.excluded ? "不计入出勤率" : week.consumedHours ? `消课 ${week.consumedHours} 课时` : "消课 0 课时"}</span>
      {week.className && <span title={week.className}>{week.className}</span>}
    </div>
  </div>;
}
