"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface MathRendererProps {
  content: string;
  block?: boolean;
  className?: string;
}

/**
 * Safely renders a LaTeX mathematical expression using KaTeX.
 * If KaTeX fails to parse, falls back to formatted monospace text without throwing.
 */
export function MathBlock({ content, block = false, className = "" }: MathRendererProps) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      // Strip outer delimiters if present: $$...$$, $...$, \[...\], \(...\)
      let formula = content.trim();
      if (formula.startsWith("$$") && formula.endsWith("$$")) {
        formula = formula.slice(2, -2).trim();
      } else if (formula.startsWith("\\[") && formula.endsWith("\\]")) {
        formula = formula.slice(2, -2).trim();
      } else if (formula.startsWith("$") && formula.endsWith("$")) {
        formula = formula.slice(1, -1).trim();
      } else if (formula.startsWith("\\(") && formula.endsWith("\\)")) {
        formula = formula.slice(2, -2).trim();
      }

      return katex.renderToString(formula, {
        displayMode: block,
        throwOnError: false,
        output: "htmlAndMathml",
      });
    } catch {
      return null;
    }
  }, [content, block]);

  if (!html) {
    return (
      <code className={`font-mono text-emerald-400 bg-slate-900/60 px-1.5 py-0.5 rounded text-sm ${className}`}>
        {content}
      </code>
    );
  }

  return (
    <span
      className={`katex-rendered inline-block ${block ? "my-2 overflow-x-auto max-w-full py-1 text-center" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Parses a paragraph of text that may contain mixed text and LaTeX delimiters ($...$ or $$...$$),
 * rendering LaTeX segments with KaTeX and regular text normally.
 */
export function FormattedTextWithMath({ text, className = "" }: { text: string; className?: string }) {
  const segments = useMemo(() => {
    if (!text) return [];

    // Match $$...$$ for block or $...$ for inline, and \[...\] or \(...\)
    const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\([\s\S]*?\\\))/g;
    const parts: Array<{ type: "text" | "math-inline" | "math-block"; value: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          value: text.slice(lastIndex, match.index),
        });
      }

      const matchStr = match[0];
      if (matchStr.startsWith("$$") || matchStr.startsWith("\\[")) {
        parts.push({ type: "math-block", value: matchStr });
      } else {
        parts.push({ type: "math-inline", value: matchStr });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex),
      });
    }

    return parts;
  }, [text]);

  if (segments.length === 0) return null;

  return (
    <div className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === "math-block") {
          return <MathBlock key={idx} content={seg.value} block={true} />;
        }
        if (seg.type === "math-inline") {
          return <MathBlock key={idx} content={seg.value} block={false} />;
        }
        return <span key={idx}>{seg.value}</span>;
      })}
    </div>
  );
}

export default MathBlock;

