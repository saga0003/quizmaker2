"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

type SortValue = string | number | boolean | Date | null | undefined;

export type DataColumn<T> = {
  key: string;
  label: ReactNode;
  value: (row: T) => SortValue;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  filter?: {
    label?: string;
    value: (row: T) => string;
  };
  align?: "left" | "center" | "right";
};

type SortableDataTableProps<T> = {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  initialSortKey?: string;
  initialSortDirection?: "asc" | "desc";
  className?: string;
};

function comparable(value: SortValue) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return value.toLocaleLowerCase();
  if (typeof value === "boolean") return value ? 1 : 0;
  return value ?? "";
}

export function SortableDataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = "Search this table",
  emptyMessage = "No matching records.",
  initialSortKey,
  initialSortDirection = "asc",
  className = "",
}: SortableDataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(initialSortKey ?? "");
  const [direction, setDirection] = useState<"asc" | "desc">(initialSortDirection);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filterColumns = columns.filter((column) => column.filter);
  const filterOptions = useMemo(() => Object.fromEntries(filterColumns.map((column) => [
    column.key,
    [...new Set(rows.map((row) => column.filter!.value(row)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  ])), [columns, filterColumns, rows]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filteredRows = rows.filter((row) => {
      if (normalizedQuery && searchText && !searchText(row).toLocaleLowerCase().includes(normalizedQuery)) return false;
      return filterColumns.every((column) => {
        const selected = filters[column.key];
        return !selected || column.filter!.value(row) === selected;
      });
    });

    if (!sortKey) return filteredRows;
    const column = columns.find((item) => item.key === sortKey);
    if (!column) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const first = comparable(column.value(a));
      const second = comparable(column.value(b));
      const result = typeof first === "number" && typeof second === "number"
        ? first - second
        : String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: "base" });
      return direction === "asc" ? result : -result;
    });
  }, [columns, direction, filterColumns, filters, query, rows, searchText, sortKey]);

  function chooseSort(column: DataColumn<T>) {
    if (column.sortable === false) return;
    if (sortKey === column.key) setDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(column.key);
      setDirection("asc");
    }
  }

  return <div className={`ev-data-table ${className}`}>
    {(searchText || filterColumns.length > 0) && <div className="ev-table-tools">
      {searchText && <label className="ev-table-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder}/></label>}
      {filterColumns.map((column) => <label className="ev-table-filter" key={column.key}>
        <SlidersHorizontal size={15}/>
        <select value={filters[column.key] ?? ""} onChange={(event) => setFilters((current) => ({ ...current, [column.key]: event.target.value }))}>
          <option value="">All {column.filter?.label ?? column.key}</option>
          {(filterOptions[column.key] ?? []).map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>)}
    </div>}
    <div className="ev-table-scroll">
      <table className="so-table ev-sortable-table">
        <thead><tr>{columns.map((column) => <th key={column.key} style={{ textAlign: column.align ?? "left" }}>
          <button type="button" disabled={column.sortable === false} onClick={() => chooseSort(column)}>
            <span>{column.label}</span>
            {column.sortable === false ? null : sortKey !== column.key ? <ArrowUpDown size={13}/> : direction === "asc" ? <ArrowUp size={13}/> : <ArrowDown size={13}/>} 
          </button>
        </th>)}</tr></thead>
        <tbody>{visibleRows.length === 0
          ? <tr><td colSpan={columns.length} className="ev-empty-cell">{emptyMessage}</td></tr>
          : visibleRows.map((row) => <tr key={rowKey(row)}>{columns.map((column) => <td key={column.key} style={{ textAlign: column.align ?? "left" }}>{column.render ? column.render(row) : String(column.value(row) ?? "")}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="ev-table-count">Showing {visibleRows.length} of {rows.length} records</div>
  </div>;
}
