function elements(node, name) {
  return Array.from(node?.getElementsByTagNameNS?.("*", name) ?? []);
}

function firstElement(node, name) {
  return elements(node, name)[0] ?? null;
}

function parseXml(text, label) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (elements(document, "parsererror").length) throw new Error(`${label} 的 XML 无法解析`);
  return document;
}

function columnIndex(reference) {
  const letters = String(reference ?? "").match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

class ZipArchive {
  constructor(buffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.files = this.readDirectory();
  }

  readDirectory() {
    const minimum = Math.max(0, this.view.byteLength - 65_557);
    let endOffset = -1;
    for (let offset = this.view.byteLength - 22; offset >= minimum; offset -= 1) {
      if (this.view.getUint32(offset, true) === 0x06054b50) {
        endOffset = offset;
        break;
      }
    }
    if (endOffset < 0) throw new Error("文件不是有效的 Excel .xlsx 文件");

    const entries = this.view.getUint16(endOffset + 10, true);
    let offset = this.view.getUint32(endOffset + 16, true);
    const decoder = new TextDecoder("utf-8");
    const files = new Map();
    for (let index = 0; index < entries; index += 1) {
      if (this.view.getUint32(offset, true) !== 0x02014b50) throw new Error("Excel 压缩目录已损坏");
      const method = this.view.getUint16(offset + 10, true);
      const compressedSize = this.view.getUint32(offset + 20, true);
      const fileNameLength = this.view.getUint16(offset + 28, true);
      const extraLength = this.view.getUint16(offset + 30, true);
      const commentLength = this.view.getUint16(offset + 32, true);
      const localOffset = this.view.getUint32(offset + 42, true);
      const nameBytes = new Uint8Array(this.buffer, offset + 46, fileNameLength);
      const name = decoder.decode(nameBytes).replace(/^\//u, "");
      files.set(name, { method, compressedSize, localOffset });
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return files;
  }

  async readText(name) {
    const entry = this.files.get(name.replace(/^\//u, ""));
    if (!entry) return null;
    const offset = entry.localOffset;
    if (this.view.getUint32(offset, true) !== 0x04034b50) throw new Error(`Excel 文件项 ${name} 已损坏`);
    const fileNameLength = this.view.getUint16(offset + 26, true);
    const extraLength = this.view.getUint16(offset + 28, true);
    const start = offset + 30 + fileNameLength + extraLength;
    const compressed = new Uint8Array(this.buffer.slice(start, start + entry.compressedSize));
    let bytes;
    if (entry.method === 0) {
      bytes = compressed;
    } else if (entry.method === 8) {
      if (typeof DecompressionStream !== "function") throw new Error("当前浏览器不支持读取压缩的 Excel 文件");
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error(`Excel 文件使用了不支持的压缩方式（${entry.method}）`);
    }
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function parseSharedStrings(xmlText) {
  if (!xmlText) return [];
  const document = parseXml(xmlText, "共享文本");
  return elements(document, "si").map((item) => elements(item, "t").map((text) => text.textContent ?? "").join(""));
}

function cellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return elements(cell, "t").map((text) => text.textContent ?? "").join("");
  const raw = firstElement(cell, "v")?.textContent ?? "";
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  if (type === "str") return raw;
  if (type === "b") return raw === "1";
  if (raw === "") return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}

function parseSheet(xmlText, sharedStrings) {
  const document = parseXml(xmlText, "消课记录");
  const matrix = [];
  for (const row of elements(document, "row")) {
    const values = [];
    for (const cell of elements(row, "c")) values[columnIndex(cell.getAttribute("r"))] = cellValue(cell, sharedStrings);
    matrix.push(values.map((value) => value ?? null));
  }
  const populated = matrix.filter((row) => row.some((value) => value !== null && value !== ""));
  const headers = (populated[0] ?? []).map((value) => String(value ?? "").trim());
  return populated.slice(1).filter((row) => row.some((value) => value !== null && value !== "")).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null]))
  );
}

export async function readLessonRecords(file) {
  if (!file?.name?.toLowerCase().endsWith(".xlsx")) throw new Error("请上传 .xlsx 格式的 Excel 文件");
  const archive = new ZipArchive(await file.arrayBuffer());
  const workbookText = await archive.readText("xl/workbook.xml");
  const relationshipsText = await archive.readText("xl/_rels/workbook.xml.rels");
  if (!workbookText || !relationshipsText) throw new Error("Excel 工作簿结构不完整");

  const workbook = parseXml(workbookText, "工作簿");
  const relationships = parseXml(relationshipsText, "工作簿关系");
  const lessonSheet = elements(workbook, "sheet").find((sheet) => sheet.getAttribute("name") === "消课记录");
  if (!lessonSheet) throw new Error("未找到工作表“消课记录”");

  const relationId = lessonSheet.getAttribute("r:id")
    ?? Array.from(lessonSheet.attributes).find((attribute) => attribute.localName === "id")?.value;
  const relation = elements(relationships, "Relationship").find((item) => item.getAttribute("Id") === relationId);
  const target = relation?.getAttribute("Target")?.replace(/^\//u, "");
  if (!target) throw new Error("无法定位工作表“消课记录”");
  const sheetPath = target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//u, "")}`;
  const sheetText = await archive.readText(sheetPath);
  if (!sheetText) throw new Error("无法读取工作表“消课记录”");
  const sharedStrings = parseSharedStrings(await archive.readText("xl/sharedStrings.xml"));
  return parseSheet(sheetText, sharedStrings);
}
