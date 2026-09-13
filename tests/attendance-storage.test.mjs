import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeStoredFiles } from "../src/content/dashboard/attendance-storage.js";

const validFile = {
  id: "upload-1",
  name: "记录.xlsx",
  dataset: { summaries: [], weeks: [], lessons: [] },
  holidays: [{ id: "holiday-1", start: "2026-10-01", end: "2026-10-07" }],
};

test("恢复浏览器保存的有效文件和假期", () => {
  assert.deepEqual(sanitizeStoredFiles([validFile]), [validFile]);
});

test("忽略损坏或旧版本的本地文件记录", () => {
  const restored = sanitizeStoredFiles([
    null,
    { id: "missing-name", dataset: validFile.dataset },
    { id: "missing-weeks", name: "损坏.xlsx", dataset: { summaries: [], lessons: [] } },
    validFile,
  ]);
  assert.deepEqual(restored, [validFile]);
});
