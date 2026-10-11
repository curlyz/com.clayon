import { cn } from "@/lib/utils";

/**
 * The official Google "G" mark. The one brand exception to the token-only
 * colour rule (operator-approved for social sign-in): Google's brand guidelines
 * require the exact four-colour mark, so the hexes live here — and only here —
 * in this one small component.
 */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4", className)} viewBox="0 0 18 18" aria-hidden="true" role="presentation">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.18l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104h-3.0067v2.3318C1.4194 16.1423 4.9653 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 8.7104c-.18-.54-.2823-1.1168-.2823-1.7104s.1023-1.1705.2823-1.7105V3.9582H.9573C.3477 5.1732 0 6.5477 0 8s.3477 2.8268.9573 4.0418L3.964 8.7104z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5713-2.5714C13.4632.8918 11.426 0 9 0 4.9653 0 1.4194 1.8577.9573 4.9582L3.964 8.0895C4.6718 5.9623 6.656 3.5795 9 3.5795z"
      />
    </svg>
  );
}
