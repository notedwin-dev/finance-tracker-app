import React from "react";
import { usePrivacyStore } from "../src/stores/privacy.store";

export function useMask() {
  const privacyMode = usePrivacyStore((s) => s.privacyMode);

  const maskAmount = React.useCallback(
    (amount: number | string, currency?: string) => {
      const formatted = `${currency ? currency + " " : ""}${amount}`;
      if (!privacyMode) return formatted;
      return (
        <span className="group/mask inline-flex cursor-pointer transition-all duration-300">
          <span className="inline group-hover/mask:hidden whitespace-nowrap opacity-80">
            {currency ? currency + " " : ""}******
          </span>
          <span className="hidden group-hover/mask:inline whitespace-nowrap animate-fadeIn">
            {formatted}
          </span>
        </span>
      );
    },
    [privacyMode],
  );

  const maskText = React.useCallback(
    (text: string, permanentMask?: boolean) => {
      if (!text) return text;

      const getPermanentMask = (val: string) => {
        if (val.length <= 4) return "****";
        return "****" + val.slice(-4);
      };

      const displayText = permanentMask ? getPermanentMask(text) : text;
      if (!privacyMode || !text) return displayText;

      return (
        <span className="group/mask inline-flex cursor-pointer transition-all duration-300">
          <span className="inline group-hover/mask:hidden whitespace-nowrap opacity-80">
            {text.length > 8 ? text.slice(0, 2) + "********" : "******"}
          </span>
          <span className="hidden group-hover/mask:inline whitespace-nowrap animate-fadeIn">
            {displayText}
          </span>
        </span>
      );
    },
    [privacyMode],
  );

  return { maskAmount, maskText };
}
