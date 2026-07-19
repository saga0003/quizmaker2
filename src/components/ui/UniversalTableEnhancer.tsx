"use client";

import { useEffect } from "react";

type Direction = "asc" | "desc";

function cellValue(row: HTMLTableRowElement, index: number) {
  return (row.cells[index]?.innerText || "").trim();
}

function comparable(value: string) {
  const cleaned = value.replace(/[₹,%+]/g, "").replace(/,/g, "").trim();
  const numeric = Number(cleaned);
  if (cleaned && Number.isFinite(numeric)) return { type: "number" as const, value: numeric };
  const date = Date.parse(value);
  if (/\d/.test(value) && Number.isFinite(date)) return { type: "number" as const, value: date };
  return { type: "text" as const, value: value.toLocaleLowerCase() };
}

function enhance(table: HTMLTableElement) {
  if (table.dataset.evidaraEnhanced === "true" || table.classList.contains("ev-sortable-table")) return;
  const body = table.tBodies[0];
  const headerRow = table.tHead?.rows[0];
  if (!body || !headerRow || body.rows.length === 0) return;

  table.dataset.evidaraEnhanced = "true";
  const host = table.parentElement;
  if (!host) return;

  const toolbar = document.createElement("div");
  toolbar.className = "ev-auto-table-tools";
  toolbar.setAttribute("aria-label", "Table sorting and filtering controls");

  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search this table";
  search.setAttribute("aria-label", "Search this table");

  const column = document.createElement("select");
  column.setAttribute("aria-label", "Filter column");
  column.innerHTML = `<option value="">All columns</option>${Array.from(headerRow.cells).map((cell, index) => `<option value="${index}">${cell.innerText.trim() || `Column ${index + 1}`}</option>`).join("")}`;

  const value = document.createElement("select");
  value.setAttribute("aria-label", "Filter value");
  value.innerHTML = `<option value="">All values</option>`;
  value.disabled = true;

  toolbar.append(search, column, value);
  host.insertBefore(toolbar, table);

  function rows() { return Array.from(body.rows); }

  function refreshValueOptions() {
    const index = Number(column.value);
    if (column.value === "") {
      value.disabled = true;
      value.innerHTML = `<option value="">All values</option>`;
      return;
    }
    const values = [...new Set(rows().map((row) => cellValue(row, index)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    value.disabled = false;
    value.innerHTML = `<option value="">All values</option>${values.slice(0, 100).map((item) => `<option value="${item.replaceAll('"', '&quot;')}">${item}</option>`).join("")}`;
  }

  function applyFilters() {
    const query = search.value.trim().toLocaleLowerCase();
    const selectedColumn = column.value === "" ? null : Number(column.value);
    const selectedValue = value.value;
    for (const row of rows()) {
      const textMatch = !query || row.innerText.toLocaleLowerCase().includes(query);
      const valueMatch = selectedColumn === null || !selectedValue || cellValue(row, selectedColumn) === selectedValue;
      row.hidden = !(textMatch && valueMatch);
    }
  }

  search.addEventListener("input", applyFilters);
  column.addEventListener("change", () => { refreshValueOptions(); applyFilters(); });
  value.addEventListener("change", applyFilters);

  Array.from(headerRow.cells).forEach((cell, index) => {
    const label = cell.innerText.trim() || `Column ${index + 1}`;
    const control = document.createElement("button");
    control.type = "button";
    control.className = "ev-auto-sort";
    control.innerHTML = `<span>${label}</span><i aria-hidden="true">↕</i>`;
    control.setAttribute("aria-label", `Sort by ${label}`);
    cell.textContent = "";
    cell.append(control);

    let direction: Direction = "asc";
    control.addEventListener("click", () => {
      for (const other of headerRow.querySelectorAll<HTMLButtonElement>(".ev-auto-sort")) {
        if (other !== control) other.querySelector("i")!.textContent = "↕";
      }
      const sorted = rows().sort((first, second) => {
        const a = comparable(cellValue(first, index));
        const b = comparable(cellValue(second, index));
        const result = a.type === "number" && b.type === "number"
          ? Number(a.value) - Number(b.value)
          : String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: "base" });
        return direction === "asc" ? result : -result;
      });
      for (const row of sorted) body.append(row);
      control.querySelector("i")!.textContent = direction === "asc" ? "↑" : "↓";
      control.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
      direction = direction === "asc" ? "desc" : "asc";
    });
  });
}

export function UniversalTableEnhancer() {
  useEffect(() => {
    const scan = () => document.querySelectorAll<HTMLTableElement>("table.so-table").forEach(enhance);
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
