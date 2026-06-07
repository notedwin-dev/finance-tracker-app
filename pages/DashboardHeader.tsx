import React from "react";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { MaskText } from "./DashboardTypes";

type Props = {
	profileName: string | undefined;
	maskText: MaskText;
};

const formatTodayLong = (): string =>
	new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
		year: "numeric",
	});

const formatTodayShort = (): string =>
	new Date().toLocaleDateString("en-US", {
		weekday: "long",
		day: "numeric",
		month: "short",
		year: "numeric",
	});

export const DashboardHeader = ({ profileName, maskText }: Props) => (
	<div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-1 sm:gap-6 py-4 sm:py-6 sm:pt-10">
		<div>
			<div className="hidden sm:flex items-center gap-3 text-gray-400 mb-1">
				<CalendarIcon className="w-5 h-5" />
				<span className="text-sm font-medium">{formatTodayLong()}</span>
			</div>
			<span className="text-[10px] sm:hidden font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 block">
				{formatTodayShort()}
			</span>
			<h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
				Welcome back, {maskText(profileName?.split(" ")[0] || "User")}!
			</h1>
		</div>
	</div>
);
