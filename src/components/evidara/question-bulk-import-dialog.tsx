'use client';

import type { ComponentProps, ComponentType } from 'react';
import { QuestionBulkImportDialog as CoreQuestionBulkImportDialog } from './question-bulk-import-dialog-core';

type CoreProps = ComponentProps<typeof CoreQuestionBulkImportDialog>;
type PaperImportProps = Omit<CoreProps, 'onImported'> & {
  onImported: () => unknown | Promise<unknown>;
};

export const QuestionBulkImportDialog = CoreQuestionBulkImportDialog as unknown as ComponentType<PaperImportProps>;
