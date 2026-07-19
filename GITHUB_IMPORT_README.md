# Import ScholarOS V4 safely into GitHub

This package is intended to replace the application source on a new branch while preserving the existing `main` production branch.

## Recommended Windows workflow

1. Extract this ZIP.
2. Open PowerShell inside the extracted `scholaros_v4` folder.
3. Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\IMPORT_TO_GITHUB_SAFE.ps1
```

The script:

- clones `saga0003/quizmaker2`;
- creates `import/scholaros-v4` from the current `main` branch;
- replaces only the branch working tree;
- rejects local `.env` and `.vercel` data;
- removes generated and transfer-only files;
- runs `npm ci` and `npm run check`;
- stages the verified replacement;
- stops before commit and push.

After reviewing the displayed Git changes, run the two commands printed by the script. Then open a pull request from `import/scholaros-v4` into `main`. Do not merge until its Vercel Preview Deployment has been tested.
