'use client';

import { useEffect } from 'react';

function textOf(element: Element) {
  return (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function hide(element: Element | null) {
  if (!(element instanceof HTMLElement)) return;
  element.hidden = true;
  element.setAttribute('aria-hidden', 'true');
}

function normalizeQuestionTable() {
  document.querySelectorAll('table').forEach((table) => {
    const headers = Array.from(table.querySelectorAll('thead th'));
    const questionIndex = headers.findIndex((header) => textOf(header) === 'question');
    const ownershipIndex = headers.findIndex((header) => textOf(header).includes('school / ownership'));
    if (questionIndex < 0 || ownershipIndex < 0) return;

    const serialIndex = headers.findIndex((header) => ['topic serial', 'serial no.', 's.no.'].includes(textOf(header)));
    if (serialIndex >= 0 && headers[serialIndex].textContent !== 'S.No.') headers[serialIndex].textContent = 'S.No.';

    const typeIndex = headers.findIndex((header) => textOf(header) === 'type / test' || textOf(header) === 'question type');
    if (typeIndex >= 0 && headers[typeIndex].textContent !== 'Question type') headers[typeIndex].textContent = 'Question type';

    const rows = Array.from(table.querySelectorAll('tbody tr')).filter((row) => row.querySelectorAll('td').length > 1);
    rows.forEach((row, visibleIndex) => {
      if (serialIndex >= 0) {
        const cell = row.children.item(serialIndex);
        const badge = cell?.querySelector('[data-slot="badge"]') || cell?.querySelector('span');
        const expected = String(visibleIndex + 1);
        if (badge && badge.textContent !== expected) badge.textContent = expected;
        cell?.querySelectorAll('p').forEach((label) => hide(label));
      }
      if (typeIndex >= 0) {
        const cell = row.children.item(typeIndex);
        const details = cell?.querySelectorAll('p');
        if (details && details.length > 1) hide(details.item(1));
      }
    });
  });
}

function applyQuestionPolicies() {
  normalizeQuestionTable();
}

export function QuestionBankPolicy() {
  useEffect(() => {
    applyQuestionPolicies();
    const observer = new MutationObserver(applyQuestionPolicies);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
