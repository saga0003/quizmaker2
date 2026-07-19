"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, SlidersHorizontal } from "lucide-react";

export type SortableColumn<Row> = {
  key: string;
  label: string;
  value: (row: Row) => string | number | null | undefined;
  render?: (row: Row) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  align?: "left" | "center" | "right";
};

export function SortableTable<Row>({ rows, columns, rowKey, searchPlaceholder = "Search this table", emptyMessage = "No matching records.", initialSort }: {
  rows: Row[];
  columns: SortableColumn<Row>[];
  rowKey: (row: Row) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  initialSort?: { key: string; direction: "asc" | "desc" };
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort ?? { key: columns.find((column) => column.sortable !== false)?.key ?? columns[0]?.key, direction: "asc" as const });
  const [filters, setFilters] = useState<Record<string, string>>(Object.fromEntries(columns.map((column) => [column.key, "all"])));
  const [showFilters, setShowFilters] = useState(false);

  const options = useMemo(() => Object.fromEntries(columns.map((column) => [column.key, [...new Set(rows.map((row) => String(column.value(row) ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))])), [columns, rows]);

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => {
      const matchesSearch = !query || columns.some((column) => String(column.value(row) ?? "").toLowerCase().includes(query.toLowerCase()));
      const matchesFilters = columns.every((column) => !column.filterable || filters[column.key] === "all" || String(column.value(row) ?? "") === filters[column.key]);
      return matchesSearch && matchesFilters;
    });
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return filtered;
    return [...filtered].sort((left, right) => {
      const a = column.value(left);
      const b = column.value(right);
      const result = typeof a === "number" && typeof b === "number" ? a - b : String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, filters, query, rows, sort]);

  function changeSort(key: string) {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  }

  return <div className="ev-table-module">
    <div className="ev-table-toolbar">
      <label className="so-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder}/></label>
      {columns.some((column) => column.filterable) && <button type="button" className="rm-btn-secondary" onClick={() => setShowFilters((value) => !value)}><SlidersHorizontal size={16}/> Filters</button>}
      <span>{visible.length} of {rows.length}</span>
    </div>
    {showFilters && <div className="ev-table-filters">{columns.filter((column) => column.filterable).map((column) => <label key={column.key}>
      <span>{column.label}</span>
      <select className="so-input" value={filters[column.key]} onChange={(event) => setFilters((current) => ({ ...current, [column.key]: event.target.value }))}>
        <option value="all">All</option>
        {(options[column.key] as string[]).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>)}</div>}
    <div className="so-table-wrap"><table className="so-table ev-sortable-table">
      <thead><tr>{columns.map((column) => <th key={column.key} style={{ textAlign: column.align ?? "left" }}>
        {column.sortable === false ? column.label : <button type="button" onClick={() => changeSort(column.key)} aria-label={`Sort by ${column.label}`}>
          {column.label}{sort.key !== column.key ? <ChevronsUpDown size={13}/> : sort.direction === "asc" ? <ArrowUp size={13}/> : <ArrowDown size={13}/>} 
        </button>}
      </th>)}</tr></thead>
      <tbody>{visible.length === 0 ? <tr><td colSpan={columns.length} className="ev-empty-cell">{emptyMessage}</td></tr> : visible.map((row) => <tr key={rowKey(row)}>{columns.map((column) => <td key={column.key} style={{ textAlign: column.align ?? "left" }}>{column.render ? column.render(row) : String(column.value(row) ?? "")}</td>)}</tr>)}</tbody>
    </table></div>
  </div>;
}
