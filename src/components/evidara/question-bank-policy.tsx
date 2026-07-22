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
      hide(control.closest('.space-y-2') || control.parentElement);
    }
  });

  document.querySelectorAll('table').forEach((table) => {
    const headers = Array.from(table.querySelectorAll('thead th'));
    const testTypeIndex = headers.findIndex((header) => textOf(header) === 'test type');
    if (testTypeIndex < 0) return;
    hide(headers[testTypeIndex]);
    table.querySelectorAll('tbody tr').forEach((row) => hide(row.children.item(testTypeIndex)));
  });
}

export function QuestionBankPolicy() {
  useEffect(() => {
    removeQuestionTestTypeUi();
    const observer = new MutationObserver(removeQuestionTestTypeUi);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
