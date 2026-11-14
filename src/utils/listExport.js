// 2026-11-13 (Owner console, typed: "כן מאשר את שלושת החלקים" - part 1: export the clients and the catalog to Excel, like the quotes
// export): one Excel sheet with the business name, the export date, a header row and one row per item - the same look as quotes_report.xlsx.
// The market decides the language and the direction of the sheet (as in the quotes export), never the screen language.
import ExcelJS from 'exceljs';

/** builds the workbook (separate from the download so it can be checked in tests) */
export function buildListWorkbook({ sheetName, title, dateLine, headers, widths, rows, rtl }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: Boolean(rtl) }] });
  const align = rtl ? 'right' : 'left';
  sheet.columns = widths.map((width) => ({ width }));
  sheet.mergeCells(1, 1, 1, headers.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
  titleCell.alignment = { horizontal: align, vertical: 'middle' };
  sheet.mergeCells(2, 1, 2, headers.length);
  const dateCell = sheet.getCell(2, 1);
  dateCell.value = dateLine;
  dateCell.font = { size: 10, color: { argb: 'FF000000' } };
  dateCell.alignment = { horizontal: align, vertical: 'middle' };
  const headerRow = sheet.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FF000000' } };
    cell.alignment = { horizontal: align, vertical: 'middle' };
  });
  rows.forEach((values, r) => {
    const row = sheet.getRow(5 + r);
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v == null ? '' : v;
      cell.font = { color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: align, vertical: 'middle' };
    });
  });
  return workbook;
}

export async function downloadListXlsx(spec) {
  const workbook = buildListWorkbook(spec);
  const data = await workbook.xlsx.writeBuffer();
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', spec.fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
