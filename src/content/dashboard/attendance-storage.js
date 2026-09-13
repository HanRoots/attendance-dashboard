const DATABASE_NAME = "attendance-dashboard";
const DATABASE_VERSION = 1;
const STORE_NAME = "workspace";
const WORKSPACE_KEY = "attendance-workspace-v1";

let databasePromise;
let pendingSave = Promise.resolve();

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地数据存储"));
  });

  return databasePromise;
}

export async function loadAttendanceWorkspace() {
  const database = await openDatabase();
  if (!database) return null;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(WORKSPACE_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error("无法读取本地数据"));
  });
}

async function writeAttendanceWorkspace(workspace) {
  const database = await openDatabase();
  if (!database) throw new Error("当前浏览器不支持本地数据存储");

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(workspace, WORKSPACE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("无法保存本地数据"));
    transaction.onabort = () => reject(transaction.error ?? new Error("本地数据保存已中止"));
  });
}

export function saveAttendanceWorkspace(workspace) {
  pendingSave = pendingSave.catch(() => undefined).then(() => writeAttendanceWorkspace(workspace));
  return pendingSave;
}

export function sanitizeStoredFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.flatMap((file) => {
    const dataset = file?.dataset;
    if (typeof file?.id !== "string" || typeof file?.name !== "string"
      || !dataset || !Array.isArray(dataset.summaries)
      || !Array.isArray(dataset.weeks) || !Array.isArray(dataset.lessons)) return [];
    return [{
      id: file.id,
      name: file.name,
      dataset,
      holidays: Array.isArray(file.holidays) ? file.holidays : [],
    }];
  });
}
