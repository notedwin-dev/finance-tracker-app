import React from "react";
import { useMaskStore } from "../src/stores/mask.store";

export function useMask() {
  const maskMode = useMaskStore((s) => s.maskMode);

  const maskAmount = React.useCallback(
    (amount: number | string, currency?: string) => {
      const formatted = `${currency ? currency + " " : ""}${amount}`;
      if (!maskMode) return formatted;
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
    [maskMode],
  );

  const maskText = React.useCallback(
    (text: string, permanentMask?: boolean) => {
      if (!text) return text;

      const getPermanentMask = (val: string) => {
        if (val.length <= 4) return "****";
        return "****" + val.slice(-4);
      };

      const displayText = permanentMask ? getPermanentMask(text) : text;
      const previewMask = permanentMask
        ? getPermanentMask(text)
        : text.length > 8
          ? text.slice(0, 2) + "********"
          : "******";
      if (!maskMode || !text) return displayText;

      return (
        <span className="group/mask inline-flex cursor-pointer transition-all duration-300">
          <span className="inline group-hover/mask:hidden whitespace-nowrap opacity-80">
            {previewMask}
          </span>
          <span className="hidden group-hover/mask:inline whitespace-nowrap animate-fadeIn">
            {displayText}
          </span>
        </span>
      );
    },
    [maskMode],
  );

  return { maskAmount, maskText };
}
