"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { resendVerificationAction } from "@/app/actions/public-signup";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ResendVerification() {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await resendVerificationAction();
            if (result && "error" in result) setError(result.error);
            else if (result && "token" in result) {
              setError(null);
              setToken(result.token ?? null);
            }
          })
        }
      >
        {pending ? t("common.saving") : t("apply.resendLink")}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {token && (
        <Link href={`/apply/verify?token=${token}`} className="block break-all rounded-lg bg-surface-sunken px-3 py-2 text-xs text-gold hover:underline">
          /apply/verify?token={token}
        </Link>
      )}
    </div>
  );
}
