'use client';

import { useEffect } from 'react';

const TEST_TYPE_LABELS = new Set([
  'full length test',
  'part test',
  'chapter test',
  'topic test',
  'custom',
]);

function textOf(element: Element) {
  return (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function hide(element: Element | null) {
  if (!(element instanceof HTMLElement) || element.dataset.questionTestTypeHidden === 'true') return;
  element.dataset.questionTestTypeHidden = 'true';
  element.hidden = true;
  element.setAttribute('aria-hidden', 'true');
}

function isQuestionDialog(dialog: Element) {
  const title = textOf(dialog.querySelector('[data-slot="dialog-title"]') || dialog);
  return title.includes('question') || title.includes('bulk import');
}

function removeQuestionTestTypeUi() {
  document.querySelectorAll('[data-slot="dialog-content"]').forEach((dialog) => {
    if (!isQuestionDialog(dialog)) return;

    dialog.querySelectorAll('label').forEach((label) => {
      const labelText = textOf(label).replace(/\s*\*$/, '');
      if (labelText === 'test type' || labelText === 'custom test type') {
        hide(label.closest('.space-y-2') || label.parentElement?.parentElement || label.parentElement);
      }
    });

    const header = dialog.querySelector('[data-slot="dialog-header"]');
    header?.querySelectorAll('[data-slot="badge"]').forEach((badge) => {
      if (TEST_TYPE_LABELS.has(textOf(badge))) hide(badge);
    });

    dialog.querySelectorAll('strong').forEach((strong) => {
      if (textOf(strong) === 'test type') {
        hide(strong.closest('.flex.items-start.gap-2') || strong.parentElement?.parentElement || strong.parentElement);
      }
    });
  });

  document.querySelectorAll('button, [role="combobox"]').forEach((control) => {
    const value = textOf(control);
    if (value === 'all test types' || value === 'select test type') {
      hide(control.closest('.space-y-2') || control);
    }
  });

  document.querySelectorAll('[role="option"]').forEach((option) => {
    if (textOf(option) === 'topic serial') hide(option);
  });
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
  removeQuestionTestTypeUi();
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
