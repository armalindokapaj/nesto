import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  color = "#1A1D23",
  size = 32,
  className,
  src,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
  src?: string | null;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn("inline-flex items-center justify-center rounded-full text-white font-medium shrink-0 overflow-hidden", className)}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="h-full w-full object-cover" />}
      <AvatarPrimitive.Fallback>{initials(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
