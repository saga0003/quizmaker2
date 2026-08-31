"use client";

import { Fragment, useMemo } from "react";
import { BlockMath, InlineMath } from "react-katex";

function safeFallback(latex: string) {
  return latex.replace(/[<>&]/g, "");
}

export function MathBlock({ latex, inline = false }: { latex?: string; inline?: boolean }) {
  const normalized = useMemo(() => latex?.trim() ?? "", [latex]);
  if (!normalized) return null;

  const renderError = () => <code>{safeFallback(normalized)}</code>;

  return (
    <span className={inline ? "evidara-math math-inline" : "evidara-math math-block block overflow-x-auto"}>
      {inline ? (
        <InlineMath math={normalized} renderError={renderError} />
      ) : (
        <BlockMath math={normalized} renderError={renderError} />
      )}
    </span>
  );
}

export function MixedMathText({ text, className = "" }: { text?: string; className?: string }) {
  const parts = useMemo(() => {
    if (!text) return [];
    const tokens: Array<{ value: string; math: boolean; display: boolean }> = [];
    const regex = /(\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\((.*?)\\\)|\$([^$\n]+)\$)/g;
    let lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const index = match.index ?? 0;
      if (index > lastIndex) tokens.push({ value: text.slice(lastIndex, index), math: false, display: false });
      tokens.push({
        value: match[2] ?? match[3] ?? match[4] ?? match[5] ?? "",
        math: true,
        display: match[0].startsWith("\\[") || match[0].startsWith("$$"),
      });
      lastIndex = index + match[0].length;
    }
    if (lastIndex < text.length) tokens.push({ value: text.slice(lastIndex), math: false, display: false });
    return tokens;
  }, [text]);

  if (!text) return null;
  return (
    <span className={className}>
      {parts.map((part, index) => part.math ? (
        <MathBlock key={index} latex={part.value} inline={!part.display} />
      ) : (
        <Fragment key={index}>{part.value}</Fragment>
      ))}
    </span>
  );
}

export function RichQuestionContent({
  text,
  latex,
  imageUrl,
  passageText,
  imageAlt = "Question illustration",
  textClassName = "",
}: {
  text?: string;
  latex?: string;
  imageUrl?: string;
  passageText?: string;
  imageAlt?: string;
  textClassName?: string;
}) {
  return (
    <div className="min-w-0">
      {passageText ? <div className="mb-4 whitespace-pre-wrap leading-relaxed"><MixedMathText text={passageText} /></div> : null}
      {text ? <div className={`whitespace-pre-wrap leading-relaxed ${textClassName}`.trim()}><MixedMathText text={text} /></div> : null}
      {latex ? <div className={text ? "mt-3" : ""}><MathBlock latex={latex} /></div> : null}
      {imageUrl ? <img src={imageUrl} alt={imageAlt} className="mt-4 max-h-80 max-w-full rounded-xl object-contain" /> : null}
    </div>
  );
}

export function RichOptionContent({
  text,
  latex,
  imageUrl,
  imageAlt,
}: {
  text?: string;
  latex?: string;
  imageUrl?: string;
  imageAlt: string;
}) {
  return (
    <div className="min-w-0">
      {text ? <div className="whitespace-pre-wrap leading-relaxed"><MixedMathText text={text} /></div> : null}
      {latex ? <div className={text ? "mt-1" : ""}><MathBlock latex={latex} inline /></div> : null}
      {imageUrl ? <img src={imageUrl} alt={imageAlt} className="mt-2 max-h-40 max-w-full rounded-lg object-contain" /> : null}
    </div>
  );
}
