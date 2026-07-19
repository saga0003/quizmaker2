"use client";

import { useEffect } from "react";

type Direction = "asc" | "desc";

const refreshers = new WeakMap<HTMLTableElement, () => void>();

function cellValue(row: HTMLTableRowElement, index: number) {
  return (row.cells[index]?.innerText || "").trim();
}

function indianDateValue(value: string) {
  const match = value.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return timestamp;
}

function comparable(value: string) {
  const cleaned = value.replace(/[₹,%+]/g, "").replace(/,/g, "").trim();
  const numeric = Number(cleaned);
  if (cleaned && Number.isFinite(numeric)) return { type: "number" as const, value: numeric };
  const indianDate = indianDateValue(value);
  if (indianDate !== null) return { type: "number" as const, value: indianDate };
  const date = Date.parse(value);
  if (/\d/.test(value) && Number.isFinite(date)) return { type: "number" as const, value: date };
  return { type: "text" as const, value: value.toLocaleLowerCase() };
}

function enhance(table: HTMLTableElement) {
  const existingRefresh = refreshers.get(table);
  if (existingRefresh) {
    existingRefresh();
    return;
  }
  if (table.classList.contains("ev-sortable-table")) return;

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
  const allColumns = document.createElement("option");
  allColumns.value = "";
  allColumns.textContent = "All columns";
  column.append(allColumns);

  Array.from(headerRow.cells).forEach((cell, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = cell.innerText.trim() || `Column ${index + 1}`;
    column.append(option);
  });

  const value = document.createElement("select");
  value.setAttribute("aria-label", "Filter value");
  const allValues = document.createElement("option");
  allValues.value = "";
  allValues.textContent = "All values";
  value.append(allValues);
  value.disabled = true;

  toolbar.append(search, column, value);
  host.insertBefore(toolbar, table);

  function rows() { return Array.from(body.rows); }

  function refreshValueOptions() {
    const previous = value.value;
    value.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All values";
    value.append(all);
    if (column.value === "") {
      value.disabled = true;
      return;
    }
    const index = Number(column.value);
    const values = [...new Set(rows().map((row) => cellValue(row, index)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    values.slice(0, 100).forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      value.append(option);
    });
    value.disabled = false;
    if (values.includes(previous)) value.value = previous;
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

  refreshers.set(table, applyFilters);
  search.addEventListener("input", applyFilters);
  column.addEventListener("change", () => { refreshValueOptions(); applyFilters(); });
  value.addEventListener("change", applyFilters);

  Array.from(headerRow.cells).forEach((cell, index) => {
    const label = cell.innerText.trim() || `Column ${index + 1}`;
    if (/^(actions?|manage|controls?)$/i.test(label) || cell.querySelector("button,a,input,select")) return;
    const control = document.createElement("button");
    control.type = "button";
    control.className = "ev-auto-sort";
    const text = document.createElement("span");
    text.textContent = label;
    const indicator = document.createElement("i");
    indicator.setAttribute("aria-hidden", "true");
    indicator.textContent = "↕";
    control.append(text, indicator);
    control.setAttribute("aria-label", `Sort by ${label}`);
    cell.replaceChildren(control);
    cell.setAttribute("aria-sort", "none");

    let direction: Direction = "asc";
    control.addEventListener("click", () => {
      for (const other of headerRow.querySelectorAll<HTMLButtonElement>(".ev-auto-sort")) {
        if (other !== control) {
          const icon = other.querySelector("i");
          if (icon) icon.textContent = "↕";
          other.closest("th")?.setAttribute("aria-sort", "none");
        }
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
      indicator.textContent = direction === "asc" ? "↑" : "↓";
      cell.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
      direction = direction === "asc" ? "desc" : "asc";
      applyFilters();
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
