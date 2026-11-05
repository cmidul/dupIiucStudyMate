import { FormattedTextWithMath } from "@/components/MathRenderer";

const assemblyLine = /^\s*[a-z][a-z0-9.]*\s+\$[a-z0-9]+(?:,|\s|$)/i;
const questionHeading = /^Q(?:uestion)?\s*\d+[a-z]?\b/i;

export default function SolutionText({ text }: { text: string }) {
  return (
    <div className="answer-content space-y-3">
      {text.split(/(```[^\n]*\n[\s\S]*?```)/g).flatMap((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          return <pre key={index}><code>{part.slice(part.indexOf("\n") + 1, -3).trimEnd()}</code></pre>;
        }

        const blocks: { code: boolean; lines: string[] }[] = [];
        for (const line of part.split("\n")) {
          const code = assemblyLine.test(line);
          const previous = blocks[blocks.length - 1];
          if (previous?.code === code) previous.lines.push(line);
          else blocks.push({ code, lines: [line] });
        }

        return blocks.map(({ code, lines }, block) => {
          const key = `${index}-${block}`;
          if (code) return <pre key={key}><code>{lines.join("\n")}</code></pre>;

          return (
            <div key={key} className="space-y-2">
              {lines.join("\n").trim().split(/\n\s*\n/).filter(Boolean).map((paragraph, i) => {
                const [first, ...rest] = paragraph.split("\n");
                const title = first.replace(/^#{1,6}\s+/, "").replace(/^\*\*(.*?)\*\*:?$/, "$1");
                if (title !== first || questionHeading.test(title)) {
                  return (
                    <div key={i}>
                      <p className="font-semibold">{title}</p>
                      {rest.length > 0 && <FormattedTextWithMath text={rest.join("\n")} className="whitespace-pre-wrap" />}
                    </div>
                  );
                }
                return <FormattedTextWithMath key={i} text={paragraph} className="whitespace-pre-wrap" />;
              })}
            </div>
          );
        });
      })}
    </div>
  );
}
