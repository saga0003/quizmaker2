# Option LaTeX normalization

Imported answer options that contain inline `$...$` mathematics are stored in `question_options.content_latex`, not `content_text`.

The database trigger introduced by migration 49:

- converts paired inline dollar delimiters into KaTeX-ready LaTeX;
- moves mixed text-and-math option content from `content_text` to `content_latex`;
- leaves genuine plain-text options unchanged;
- normalizes future direct imports and editor saves.

Example:

- input: `0 and $\\sqrt{2} \\frac{h}{2 \\pi}$`
- stored LaTeX: `\\text{0 and}\\;\\sqrt{2} \\frac{h}{2 \\pi}`
