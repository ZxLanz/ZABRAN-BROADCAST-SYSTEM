import { parse } from "csv-parse/sync";

export function parseCSV(buffer) {
  const text = buffer.toString("utf-8");

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
  });

  // Normalisasi data agar sesuai schema Customer
  return rows.map((row) => ({
    name: row.name || row.nama || "",
    phone: row.phone || row.nomor || row.no || "",
    division: row.division || "",
    tags: row.tags ? row.tags.split(",").map(t => t.trim()) : [],
    email: row.email || "",
  }));
}
