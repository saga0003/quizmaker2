# Evidara V19.1 — LaTeX / KaTeX Paper Import

## What changed

V19.1 brings the NatSciX-style rich question import discipline into Evidara without replacing Evidara's stronger PYQ/paper database engine.

Each question can now be imported with independent fields for normal text, LaTeX/KaTeX, question image, option text, option LaTeX, option image, solution text and solution LaTeX. Mixed text such as `The velocity is \(v=u+at\)` is rendered as prose plus inline math instead of forcing the whole sentence through KaTeX.

## Recommended workflow

Use **one file or ZIP per paper/set**. For example:

- `NEET_2026_Main.zip`
- `NEET_2025_Main.zip`
- `NEET_2024_ReNEET.zip`

Inside a ZIP keep exactly one `.tex` paper source plus its referenced images. Evidara reads the header, previews the questions, uploads local image assets to the configured question-asset storage, checks duplicates, and then creates the draft paper and its question-bank records together.

## Paper identity

The paper header supports:

- `\paper{...}`
- `\exam{...}`
- `\year{...}`
- `\variant{...}` or `\set{...}`
- `\code{...}`
- `\duration{...}`
- `\grade{...}`
- `\pyq{true}`
- `\sourcekey{...}`

For PYQs this feeds Evidara's existing `pyq_source_papers` and `question_pyq_occurrences` engine, so the same reusable question can retain its exact paper/year occurrence rather than being duplicated just because it appears in another paper.

## Question blocks

Use one `\begin{question} ... \end{question}` block per question. Important commands include `\id`, `\number`, `\section`, `\subject`, `\chapter`, `\topic`, `\questiontype`, `\difficulty`, `\stem`, `\latex`, `\option`, `\answer`, `\solution` and `\marks`.

See `public/templates/Evidara_LaTeX_Paper_Template.tex` for the working format.

## Rendering rule

- Ordinary text stays in the normal UI font.
- Inline `$...$` or `\(...\)` math is rendered with KaTeX inside the text.
- Display `$$...$$` or `\[...\]` math is rendered as a display block.
- Explicit `\latex{...}` is stored in the dedicated LaTeX field and rendered after the text field.
- Text and LaTeX no longer hide one another in the main learner paper views.

## Safety and review

New questions created from a paper import are saved as **In Review**. Exact duplicates can be reused. Near duplicates require a choice before commit. Missing subject/answer/image references are surfaced before paper creation. The final paper is created as a draft.
