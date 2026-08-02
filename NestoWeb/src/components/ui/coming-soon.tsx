import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Used for nav destinations that exist (no dead links) but whose module is
// genuinely a later phase — states that plainly instead of faking data or
// interactivity that isn't real yet.
export function ComingSoon({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft">
          <Construction size={20} className="text-gold-strong" />
        </span>
        <p className="max-w-sm text-sm text-ink-muted leading-relaxed">{message}</p>
      </CardContent>
    </Card>
  );
}
