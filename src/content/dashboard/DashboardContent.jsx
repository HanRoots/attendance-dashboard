import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DataComponent,
  useDataApp,
  useDashboardTabs,
} from "../../data-app-public.jsx";
import {
  applyHolidayRanges,
  buildAttendanceDataset,
  formatChineseDate,
  formatWeekRange,
} from "./attendance-model.js";
import {
  AnnualAttendanceView,
  AttendanceCalendar,
  CalendarHeaderControls,
  WeekDetail,
} from "./AttendanceCalendar.jsx";
import { HolidayPanel } from "./HolidayPanel.jsx";
import {
  loadAttendanceWorkspace,
  sanitizeStoredFiles,
  saveAttendanceWorkspace,
} from "./attendance-storage.js";
import { readLessonRecords } from "./xlsx-reader.js";
import "./attendance.css";

function YuexingrenFontStyles() {
  return <style>{`
    @font-face {
      font-family: "MiSans Local";
      src: url("./fonts/MiSans-Regular.ttf") format("truetype");
      font-style: normal;
      font-weight: 400;
      font-display: swap;
    }
    @font-face {
      font-family: "MiSans Latin Local";
      src: url("./fonts/MiSansLatin-Regular.ttf") format("truetype");
      font-style: normal;
      font-weight: 400;
      font-display: swap;
    }
  `}</style>;
}

function UploadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v5.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V13"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function FileIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 3.5h6l4 4V20H7zM13 3.5V8h4M9.5 12h5M9.5 15.5h5"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function ChevronRight() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function HolidayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.5 4.5v3M17.5 4.5v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12H4V7a1 1 0 0 1 1-1Z"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m9 14 1.8 1.8L15 11.5" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function weekTone(week) {
  if (week.excluded) return "holiday";
  return week.attended ? "attended" : "absent";
}

function Metric({ id, title, value, suffix, detail, tone, summary, sourceSummary }) {
  return <DataComponent variant="plain" id={id} queryId="student_summary" kind="metric"
    title={title} sourceRows={[sourceSummary ?? summary]} displayRows={[summary]} className="attendance-metric">
    <div className="attendance-metric-value" data-tone={tone}>
      <strong>{value}</strong>{suffix && <span>{suffix}</span>}
    </div>
    <span className="attendance-metric-detail">{detail}</span>
  </DataComponent>;
}

function RecentFilter({ filter, onChange }) {
  return <label className="recent-filter">
    <span className="sr-only">筛选最近教学周</span>
    <select value={filter} onChange={(event) => onChange(event.target.value)}>
      <option value="all">全部</option>
      <option value="attended">仅出勤</option>
      <option value="absent">仅缺勤</option>
      <option value="holiday">仅放假</option>
    </select>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </label>;
}

function RecentWeekList({ rows, filter, selectedWeek, onSelect }) {
  const filtered = rows.filter((week) => filter === "all"
    || (filter === "attended" && week.attended)
    || (filter === "absent" && !week.attended && !week.excluded)
    || (filter === "holiday" && week.excluded)).slice(-6).reverse();

  return <div className="recent-week-list" data-reviewed-rows>
      {filtered.length ? filtered.map((week) => <button type="button" key={week.weekStart}
        className="recent-week-row" data-selected={selectedWeek === week.weekStart || undefined}
        data-tone={weekTone(week)}
        onClick={() => onSelect(week)}>
        <span className="recent-week-dates">
          <strong>{formatWeekRange(week.weekStart, week.weekEnd)}</strong>
          <span>{week.lessonDate ? `${week.lessonDate.slice(5).replace("-", "/")} 上课`
            : week.excluded ? (week.holidayName || "自定义放假") : "无上课记录"}</span>
        </span>
        <span className="status-label" data-tone={weekTone(week)}><i />{week.status}</span>
        <ChevronRight />
      </button>) : <div className="empty-filter-result">当前筛选下没有教学周</div>}
    </div>;
}

function AttendanceTrend({ rows, selectedWeek, onSelect }) {
  const weeks = rows.slice(-12);
  return <div className="trend-chart" data-reviewed-rows role="list" aria-label="近12周出勤趋势">
    {weeks.map((week) => <button type="button" key={week.weekStart} role="listitem"
      className="trend-week" data-tone={weekTone(week)}
      data-selected={selectedWeek === week.weekStart || undefined}
      aria-label={`${formatWeekRange(week.weekStart, week.weekEnd)}，${week.status}`}
      onClick={() => onSelect(week)}>
      <span className="trend-bar-wrap"><i className="trend-bar" /></span>
      <span>{week.weekStart.slice(5).replace("-", "/")}</span>
    </button>)}
  </div>;
}

function StudentNameLine({ summary, summaries, studentKey, onStudentChange }) {
  if (!summary) return null;
  return <div className="student-name-line" aria-label={`当前学生：${summary.studentName}`}>
    {summaries.length > 1 ? <label className="student-name-select">
      <span className="sr-only">学生姓名</span>
      <select value={studentKey} onChange={(event) => onStudentChange(event.target.value)}>
        {summaries.map((item) => <option key={item.studentKey} value={item.studentKey}>{item.studentName}</option>)}
      </select>
    </label> : <strong>{summary.studentName}</strong>}
  </div>;
}

function DashboardHeader({
  summary,
  busy,
  onUpload,
  files,
  activeFileId,
  onSelectFile,
  onDeleteFile,
  holidayCount,
  holidayOpen,
  onToggleHolidays,
}) {
  const inputRef = useRef(null);
  return <section className="attendance-header" aria-label="数据概况">
    <div className="student-summary">
      {summary ? <>
        <div className="student-identity">
          <span>学号：<strong>{summary.studentId || "—"}</strong></span>
        </div>
        <span>统计区间：<strong>{formatChineseDate(summary.firstWeek)}—{formatChineseDate(summary.lastWeekEnd)}</strong></span>
        <span>教学周：<strong>周五至次周周四</strong></span>
      </> : <span className="no-file-summary">请上传 Excel 开始统计</span>}
    </div>
    <div className="file-actions">
      <label className="upload-button" data-busy={busy || undefined}>
        <UploadIcon />
        <span>{busy ? "正在读取…" : "上传 Excel"}</span>
        <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple disabled={busy} onChange={async (event) => {
            const selectedFiles = Array.from(event.target.files ?? []);
            if (selectedFiles.length) await onUpload(selectedFiles);
            event.target.value = "";
          }} />
      </label>
      <a className="template-download-button" href="./attendance-template.xlsx" download="出勤记录模板.xlsx">
        <DownloadIcon />
        <span>Excel 模板</span>
      </a>
      <button type="button" className="holiday-settings-button" aria-expanded={holidayOpen}
        disabled={!summary} onClick={onToggleHolidays}>
        <HolidayIcon />
        <span>{holidayCount ? `假期设置 · ${holidayCount}` : "假期设置"}</span>
      </button>
      <div className="file-switcher" role="list" aria-label="已上传文件">
        {files.map((file) => <div className="file-chip" data-active={file.id === activeFileId || undefined}
          role="listitem" key={file.id} title={file.name}>
          <button type="button" className="file-chip-select" aria-pressed={file.id === activeFileId}
            onClick={() => onSelectFile(file)}>
            <FileIcon /><span>{file.name}</span>
          </button>
          <button type="button" className="file-chip-delete" aria-label={`删除 ${file.name}`}
            onClick={() => onDeleteFile(file.id)}>×</button>
        </div>)}
      </div>
    </div>
  </section>;
}

export function DashboardContent() {
  useDashboardTabs([{ id: "attendance", label: "出勤概览" }]);
  const { queries, reviewedRows } = useDataApp();
  const seedDataset = useMemo(() => ({
    summaries: reviewedRows("student_summary", ["studentKey"]),
    weeks: reviewedRows("teaching_weeks", ["studentKey", "weekStart"]),
    lessons: reviewedRows("lesson_records", ["studentId", "date", "recordId"]),
  }), [reviewedRows]);
  const seedFileName = queries.student_summary?.source?.files?.[0] ?? "参考课消.xlsx";
  const seedFile = useMemo(() => ({
    id: "reference-file",
    name: seedFileName,
    dataset: seedDataset,
    holidays: [],
  }), [seedFileName, seedDataset]);
  const [files, setFiles] = useState(() => [seedFile]);
  const [activeFileId, setActiveFileId] = useState(seedFile.id);
  const [studentKey, setStudentKey] = useState(seedDataset.summaries[0]?.studentKey ?? "");
  const [month, setMonth] = useState(seedDataset.summaries[0]?.lastLessonDate?.slice(0, 7) ?? "2026-09");
  const [year, setYear] = useState(Number(seedDataset.summaries[0]?.lastWeek?.slice(0, 4) ?? 2026));
  const [calendarView, setCalendarView] = useState("month");
  const [selectedWeek, setSelectedWeek] = useState(seedDataset.summaries[0]?.lastWeek ?? null);
  const [recentFilter, setRecentFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [holidayPanelOpen, setHolidayPanelOpen] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const baseDataset = activeFile?.dataset;
  const holidayRanges = activeFile?.holidays ?? [];
  const dataset = useMemo(() => baseDataset
    ? applyHolidayRanges(baseDataset, holidayRanges)
    : undefined, [baseDataset, holidayRanges]);
  const summary = dataset?.summaries.find((item) => item.studentKey === studentKey) ?? dataset?.summaries[0];
  const sourceSummary = baseDataset?.summaries.find((item) => item.studentKey === summary?.studentKey)
    ?? baseDataset?.summaries[0];
  const weeks = dataset?.weeks.filter((week) => week.studentKey === summary?.studentKey) ?? [];
  const sourceWeeks = baseDataset?.weeks.filter((week) => week.studentKey === summary?.studentKey) ?? [];
  const lessons = dataset?.lessons.filter((lesson) => summary
    && (lesson.studentId === summary.studentId || (!summary.studentId && lesson.studentName === summary.studentName))) ?? [];
  const activeWeek = weeks.find((week) => week.weekStart === selectedWeek) ?? weeks.at(-1);

  useEffect(() => {
    let cancelled = false;
    loadAttendanceWorkspace().then((stored) => {
      if (cancelled) return;
      const uploadedFiles = sanitizeStoredFiles(stored?.files)
        .filter((file) => file.id !== seedFile.id);
      const nextFiles = stored?.referenceVisible === false
        ? uploadedFiles
        : [seedFile, ...uploadedFiles];
      const nextActiveFile = nextFiles.find((file) => file.id === stored?.activeFileId) ?? nextFiles[0];
      const nextSummaries = nextActiveFile?.dataset?.summaries ?? [];
      const nextSummary = nextSummaries.find((item) => item.studentKey === stored?.studentKey)
        ?? nextSummaries[0];

      setFiles(nextFiles);
      setActiveFileId(nextActiveFile?.id ?? "");
      setStudentKey(nextSummary?.studentKey ?? "");
      setMonth(typeof stored?.month === "string"
        ? stored.month
        : nextSummary?.lastLessonDate?.slice(0, 7) ?? "2026-09");
      setYear(Number.isInteger(stored?.year)
        ? stored.year
        : Number(nextSummary?.lastWeek?.slice(0, 4) ?? 2026));
      setCalendarView(stored?.calendarView === "year" ? "year" : "month");
      setSelectedWeek(typeof stored?.selectedWeek === "string"
        ? stored.selectedWeek
        : nextSummary?.lastWeek ?? null);
      setRecentFilter(["all", "attended", "absent", "holiday"].includes(stored?.recentFilter)
        ? stored.recentFilter
        : "all");
      setWorkspaceReady(true);
    }).catch(() => {
      if (cancelled) return;
      setError("无法恢复此前保存的数据，请重新上传 Excel");
      setWorkspaceReady(true);
    });
    return () => { cancelled = true; };
  }, [seedFile.id]);

  useEffect(() => {
    if (!workspaceReady) return undefined;
    let cancelled = false;
    const workspace = {
      version: 1,
      files: files.filter((file) => file.id !== seedFile.id),
      referenceVisible: files.some((file) => file.id === seedFile.id),
      activeFileId,
      studentKey,
      month,
      year,
      calendarView,
      selectedWeek,
      recentFilter,
    };
    saveAttendanceWorkspace(workspace).catch(() => {
      if (!cancelled) setError("数据已载入，但当前浏览器无法保存刷新状态");
    });
    return () => { cancelled = true; };
  }, [workspaceReady, files, activeFileId, studentKey, month, year, calendarView,
    selectedWeek, recentFilter, seedFile.id]);

  useEffect(() => {
    if (!summary) return;
    const minMonth = summary.firstWeek.slice(0, 7);
    const maxMonth = summary.lastWeekEnd.slice(0, 7);
    if (month < minMonth || month > maxMonth) setMonth(summary.lastLessonDate.slice(0, 7));
    const minYear = Number(summary.firstWeek.slice(0, 4));
    const maxYear = Number(summary.lastWeek.slice(0, 4));
    if (year < minYear || year > maxYear) setYear(maxYear);
    if (!weeks.some((week) => week.weekStart === selectedWeek)) setSelectedWeek(summary.lastWeek);
  }, [summary, month, year, selectedWeek, weeks]);

  const activateFile = (file) => {
    const nextSummary = file?.dataset?.summaries?.[0];
    setActiveFileId(file?.id ?? "");
    if (!nextSummary) {
      setStudentKey("");
      setSelectedWeek(null);
      return;
    }
    setStudentKey(nextSummary.studentKey);
    setMonth(nextSummary.lastLessonDate.slice(0, 7));
    setYear(Number(nextSummary.lastWeek.slice(0, 4)));
    setSelectedWeek(nextSummary.lastWeek);
    setRecentFilter("all");
  };

  const handleUpload = async (selectedFiles) => {
    setBusy(true);
    setError("");
    try {
      const results = await Promise.all(selectedFiles.map(async (file, index) => {
        try {
          const records = await readLessonRecords(file);
          return {
            entry: {
              id: `upload-${Date.now()}-${index}-${file.size}`,
              name: file.name,
              dataset: buildAttendanceDataset(records),
              holidays: [],
            },
          };
        } catch (uploadError) {
          return { error: `${file.name}：${uploadError instanceof Error ? uploadError.message : "读取失败"}` };
        }
      }));
      const additions = results.flatMap((result) => result.entry ? [result.entry] : []);
      const failures = results.flatMap((result) => result.error ? [result.error] : []);
      if (additions.length) {
        setFiles((current) => [...current, ...additions]);
        activateFile(additions.at(-1));
      }
      if (failures.length) setError(`以下文件未能导入：${failures.join("；")}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Excel 文件读取失败");
    } finally {
      setBusy(false);
    }
  };

  const deleteFile = (fileId) => {
    const deletedIndex = files.findIndex((file) => file.id === fileId);
    if (deletedIndex < 0) return;
    const remainingFiles = files.filter((file) => file.id !== fileId);
    setFiles(remainingFiles);
    if (activeFileId === fileId) {
      const replacement = remainingFiles[Math.min(deletedIndex, remainingFiles.length - 1)] ?? null;
      activateFile(replacement);
    }
  };

  const selectWeek = (week) => {
    setSelectedWeek(week.weekStart);
    setMonth(week.lessonDate?.slice(0, 7) ?? week.weekStart.slice(0, 7));
    setYear(Number(week.weekStart.slice(0, 4)));
  };

  const updateHolidayRanges = (updater) => {
    if (!activeFile?.id) return;
    setFiles((current) => current.map((file) => file.id === activeFile.id
      ? { ...file, holidays: updater(file.holidays ?? []) }
      : file));
  };

  const addHoliday = (range) => updateHolidayRanges((current) => [...current, range]
    .sort((left, right) => left.start.localeCompare(right.start)));
  const deleteHoliday = (rangeId) => updateHolidayRanges((current) => current
    .filter((range) => range.id !== rangeId));
  const clearHolidays = () => updateHolidayRanges(() => []);

  const changeYear = (nextYear) => {
    setYear(nextYear);
    const nextWeek = weeks.filter((week) => Number(week.weekStart.slice(0, 4)) === nextYear).at(-1);
    if (nextWeek) setSelectedWeek(nextWeek.weekStart);
  };

  const header = <DashboardHeader summary={summary} busy={busy}
    onUpload={handleUpload} files={files} activeFileId={activeFile?.id ?? ""}
    onSelectFile={activateFile} onDeleteFile={deleteFile} holidayCount={holidayRanges.length}
    holidayOpen={holidayPanelOpen} onToggleHolidays={() => setHolidayPanelOpen((open) => !open)} />;

  if (!summary) return <article className="attendance-page">
    <YuexingrenFontStyles />
    {header}
    {error && <div className="upload-error" role="alert"><strong>部分文件无法读取</strong><span>{error}</span></div>}
    <div className="attendance-empty">暂无文件，请上传标准 Excel 表格</div>
  </article>;

  const rate = summary.attendanceRate == null
    ? "—"
    : new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 }).format(summary.attendanceRate);
  const sourceRowsByQuery = activeFile?.id === seedFile.id
    ? { teaching_weeks: sourceWeeks, lesson_records: lessons }
    : { teaching_weeks: [], lesson_records: [] };
  const annualWeeks = weeks.filter((week) => Number(week.weekStart.slice(0, 4)) === year);

  return <article className="attendance-page">
    <YuexingrenFontStyles />
    {header}

    {holidayPanelOpen && activeFile && <HolidayPanel fileName={activeFile.name} ranges={holidayRanges}
      weeks={weeks} onAdd={addHoliday} onDelete={deleteHoliday} onClear={clearHolidays}
      onClose={() => setHolidayPanelOpen(false)} />}

    {error && <div className="upload-error" role="alert"><strong>无法读取此文件</strong><span>{error}</span></div>}

    <section className="student-overview" aria-label="学生出勤摘要">
      <StudentNameLine summary={summary} summaries={dataset?.summaries ?? []}
        studentKey={summary.studentKey} onStudentChange={setStudentKey} />
      <section className="metric-rail" aria-label="出勤摘要">
        <Metric id="attendance-rate" title="出勤率" value={rate} tone="attended"
          detail={`${summary.attendedWeeks} / ${summary.expectedWeeks} 个应统计教学周`} summary={summary}
          sourceSummary={sourceSummary} />
        <Metric id="attended-weeks" title="出勤教学周" value={summary.attendedWeeks} tone="attended"
          detail={`共 ${summary.lessonRecords} 条消课记录`} summary={summary} sourceSummary={sourceSummary} />
        <Metric id="absent-weeks" title="缺勤教学周" value={summary.absentWeeks} tone="absent"
          detail={summary.excludedWeeks ? `已排除 ${summary.excludedWeeks} 个放假周` : "区间内无消课记录"}
          summary={summary} sourceSummary={sourceSummary} />
        <Metric id="consumed-hours" title="累计消课" value={summary.consumedHours} suffix="课时"
          detail={`当前剩余 ${summary.currentBalance ?? "—"} 课时`} summary={summary} sourceSummary={sourceSummary} />
        <Metric id="current-streak" title="连续出勤" value={summary.currentStreak} suffix="周" tone="attended"
          detail={`最长连续 ${summary.longestStreak} 周`} summary={summary} sourceSummary={sourceSummary} />
      </section>
    </section>

    <section className="attendance-main-grid">
      <DataComponent variant="card" padding="spacious" id="attendance-calendar" queryId="teaching_weeks"
        queryIds={["teaching_weeks", "lesson_records"]} kind="custom"
        title={calendarView === "year" ? "年度出勤视图" : "教学周日历"}
        description={calendarView === "year"
          ? "按自然年汇总教学周；未进入统计区间的月份不计入年度出勤率。"
          : "教学周从周五开始，到次周周四结束。周期内至少有一条消课记录即记为出勤。"}
        displayRows={calendarView === "year" ? annualWeeks : weeks} sourceRows={sourceWeeks}
        sourceRowsByQuery={sourceRowsByQuery}
        headerControls={<CalendarHeaderControls view={calendarView} onViewChange={setCalendarView}
          month={month} minMonth={summary.firstWeek.slice(0, 7)} maxMonth={summary.lastWeekEnd.slice(0, 7)}
          onMonthChange={setMonth} year={year} minYear={Number(summary.firstWeek.slice(0, 4))}
          maxYear={Number(summary.lastWeek.slice(0, 4))} onYearChange={changeYear} />} className="calendar-card">
        {calendarView === "year"
          ? <AnnualAttendanceView year={year} weeks={annualWeeks} selectedWeek={activeWeek?.weekStart}
            onSelectWeek={(week) => selectWeek(week)} />
          : <AttendanceCalendar month={month} weeks={weeks} lessons={lessons} selectedWeek={activeWeek?.weekStart}
            onSelectWeek={setSelectedWeek} />}
        <WeekDetail week={activeWeek} />
      </DataComponent>

      <DataComponent variant="card" padding="spacious" id="recent-weeks" queryId="teaching_weeks"
        kind="table" title="最近教学周" description="按教学周查看最近的出勤、上课日期和消课课时。"
        displayRows={weeks.slice(-6)} sourceRows={sourceWeeks} className="recent-card"
        headerControls={<RecentFilter filter={recentFilter} onChange={setRecentFilter} />}>
        <RecentWeekList rows={weeks} filter={recentFilter} selectedWeek={activeWeek?.weekStart} onSelect={selectWeek} />
      </DataComponent>
    </section>

    <DataComponent variant="card" padding="spacious" id="attendance-trend" queryId="teaching_weeks"
      kind="custom" title="近12周出勤趋势" description="每根柱代表一个周五至次周周四的教学周。"
      displayRows={weeks.slice(-12)} sourceRows={sourceWeeks} className="trend-card">
      <AttendanceTrend rows={weeks} selectedWeek={activeWeek?.weekStart} onSelect={selectWeek} />
    </DataComponent>
  </article>;
}
