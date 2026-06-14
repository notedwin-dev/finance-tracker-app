import type { ScriptableContext } from "chart.js";

export const createLineGradient =
	(from: string, to: string, height: number = 300) =>
	(context: ScriptableContext<"line">) => {
		const ctx = context.chart.ctx;
		const gradient = ctx.createLinearGradient(0, 0, 0, height);
		gradient.addColorStop(0, from);
		gradient.addColorStop(1, to);
		return gradient;
	};

export const indigoLineFill = {
	fill: true,
	backgroundColor: createLineGradient(
		"rgba(99, 102, 241, 0.4)",
		"rgba(99, 102, 241, 0)",
	),
	borderColor: "#6366f1",
};
