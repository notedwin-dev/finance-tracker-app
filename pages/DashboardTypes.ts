import React from "react";

export type TimeFrame = "1D" | "1W" | "1M" | "YTD" | "ALL" | "CUSTOM";

export type Currency = "MYR" | "USD";

export type TrendPoints = {
	labels: string[];
	data: number[];
};

export type TimeframeStats = {
	income: number;
	expense: number;
	change: number;
	isPositive: boolean;
	percentChange: number;
};

export type PieDatum = {
	label: string;
	value: number;
	color: string;
};

export type MaskText = (s: string) => string | React.ReactNode;
export type MaskAmount = (
	n: string,
	symbol?: string,
) => string | React.ReactNode;
