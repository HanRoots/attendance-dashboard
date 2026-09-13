# 出勤率统计

一个可直接在浏览器中使用的课程出勤仪表板。上传标准 Excel 课消记录后，按“周五至次周周四”的教学周统计出勤率。

## 在线使用

[https://hanroots.github.io/attendance-dashboard/](https://hanroots.github.io/attendance-dashboard/)

Excel 数据仅在本地浏览器中解析，不会上传到服务器。

## 功能

- 按周五至次周周四统计教学周。
- 教学周内有一次上课记录即计为出勤。
- 支持月历、年视图、近 12 周趋势和连续出勤。
- 支持多个 Excel 文件切换和删除。
- 支持自定义假期，放假周不计入应出勤周。
- 提供可直接填写的 Excel 数据模板。

## Excel 格式

支持系统导出的 `SheetJS` 工作表，也兼容旧版 `消课记录` 工作表。看板只读取以下 8 个字段，其余导出字段会自动忽略：

` 消课日期 | 学号 | 姓名 | 班级编号 | 班级 | 原课时 | 消课时 | 现课时 `

在线页面中点击“Excel 模板”即可下载。

## 本地开发

```bash
npm install
npm run dev
```

生成生产版：

```bash
npm run build
```

## License

MIT
