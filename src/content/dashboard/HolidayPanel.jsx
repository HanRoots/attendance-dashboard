import React, { useMemo, useState } from "react";
import { formatChineseDate } from "./attendance-model.js";

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 7h15M9 4h6l1 3H8l1-3Zm-2 3 .7 13h8.6L17 7M10 11v5M14 11v5"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function affectedWeekCount(range, weeks) {
  return weeks.filter((week) => !week.attended
    && range.start <= week.weekEnd
    && range.end >= week.weekStart).length;
}

export function HolidayPanel({ fileName, ranges, weeks, onAdd, onDelete, onClear, onClose }) {
  const [error, setError] = useState("");
  const totalExcluded = useMemo(() => weeks.filter((week) => week.excluded).length, [weeks]);

  const submit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("holidayName") ?? "").trim();
    const start = String(formData.get("holidayStart") ?? "");
    const end = String(formData.get("holidayEnd") ?? "");
    if (!start || !end) {
      setError("请选择完整的开始和结束日期");
      return;
    }
    if (start > end) {
      setError("结束日期不能早于开始日期");
      return;
    }
    if (ranges.some((range) => range.start === start && range.end === end)) {
      setError("这个假期区间已经添加");
      return;
    }
    onAdd({ id: `holiday-${Date.now()}`, name: name || "自定义假期", start, end });
    event.currentTarget.reset();
    setError("");
  };

  return <section className="holiday-panel" aria-labelledby="holiday-panel-title">
    <div className="holiday-panel-heading">
      <div>
        <div className="holiday-panel-title-line">
          <h2 id="holiday-panel-title">自定义放假时间</h2>
          {totalExcluded > 0 && <span className="holiday-excluded-count">已排除 {totalExcluded} 个教学周</span>}
        </div>
        <p>与放假区间相交、且没有上课记录的教学周，不计入应出勤周和缺勤周。</p>
        <span className="holiday-file-scope">仅应用于当前文件：{fileName}</span>
      </div>
      <button type="button" className="holiday-close" aria-label="关闭假期设置" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>

    <form className="holiday-form" onSubmit={submit}>
      <label className="holiday-field holiday-field--name">
        <span>假期名称</span>
        <input type="text" name="holidayName" maxLength={24} placeholder="例如：国庆假期" />
      </label>
      <label className="holiday-field">
        <span>开始日期</span>
        <input type="date" name="holidayStart" onInput={() => setError("")} />
      </label>
      <label className="holiday-field">
        <span>结束日期</span>
        <input type="date" name="holidayEnd" onInput={() => setError("")} />
      </label>
      <button type="submit" className="holiday-add-button">添加假期</button>
    </form>
    {error && <p className="holiday-form-error" role="alert">{error}</p>}

    <div className="holiday-list-heading">
      <strong>已添加假期</strong>
      {ranges.length > 1 && <button type="button" onClick={onClear}>清空全部</button>}
    </div>
    {ranges.length ? <div className="holiday-list">
      {ranges.map((range) => {
        const affected = affectedWeekCount(range, weeks);
        return <div className="holiday-row" key={range.id}>
          <span className="holiday-row-mark" aria-hidden="true" />
          <div className="holiday-row-copy">
            <strong>{range.name}</strong>
            <span>{formatChineseDate(range.start)}—{formatChineseDate(range.end)}</span>
          </div>
          <span className="holiday-row-impact">{affected ? `排除 ${affected} 个缺勤周` : "无需排除"}</span>
          <button type="button" className="holiday-delete" aria-label={`删除 ${range.name}`}
            onClick={() => onDelete(range.id)}><DeleteIcon /></button>
        </div>;
      })}
    </div> : <div className="holiday-empty">尚未添加假期，当前仍按所有教学周计算。</div>}
  </section>;
}
