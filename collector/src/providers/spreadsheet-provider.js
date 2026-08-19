import path from "node:path";
import ExcelJS from "exceljs";

function cellValue(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    if ("text" in value) return value.text;
    if ("result" in value) return value.result;
    if (Array.isArray(value.richText)) return value.richText.map((item) => item.text).join("");
  }
  return value;
}

function rowsFromWorksheet(worksheet) {
  if (!worksheet || worksheet.rowCount < 1) return [];
  const headers = worksheet.getRow(1).values.slice(1).map((value) => String(value ?? "").trim());
  const rows = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) return;
      const value = cellValue(row.getCell(index + 1));
      if (value !== null && value !== undefined && String(value).trim() !== "") hasValue = true;
      record[header] = value;
    });

    if (hasValue) rows.push(record);
  }

  return rows;
}

export class SpreadsheetProvider {
  constructor({ providerId, filePath, mapping }) {
    this.providerId = providerId;
    this.filePath = filePath;
    this.mapping = mapping;
  }

  async read() {
    const extension = path.extname(this.filePath).toLowerCase();
    const workbook = new ExcelJS.Workbook();
    let worksheet;

    if (extension === ".csv") {
      worksheet = await workbook.csv.readFile(this.filePath);
    } else if (extension === ".xlsx") {
      await workbook.xlsx.readFile(this.filePath);
      const sheetName = this.mapping.sheetName;
      worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.getWorksheet(this.mapping.sheet || 1);
    } else {
      throw new Error(`Unsupported file extension: ${extension}. Use .csv or .xlsx`);
    }

    const sourceRows = rowsFromWorksheet(worksheet);
    return sourceRows.map((sourceRow) => this.mapRow(sourceRow));
  }

  mapRow(sourceRow) {
    const columns = this.mapping.columns || {};
    const defaults = this.mapping.defaults || {};
    const record = {};

    for (const [canonicalField, sourceColumn] of Object.entries(columns)) {
      record[canonicalField] = sourceRow[sourceColumn];
    }

    return { ...defaults, ...record };
  }
}
