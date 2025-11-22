import XLSX from "xlsx";

export function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet);

  return rows.map((row) => ({
    name: row.name || row.nama || "",
    phone: row.phone || row.nomor || row.no || "",
    division: row.division || "",
    tags: row.tags ? row.tags.split(",").map(t => t.trim()) : [],
    email: row.email || "",
  }));
}
