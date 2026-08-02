// Renders a translated headline line, turning a `**word**` marker into a
// gold-highlighted span. Lets each locale's translation decide which word
// (and which line) carries the highlight — Albanian word order doesn't
// always put the emphasised word where English does.
export function HighlightedLine({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="text-gold">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}
