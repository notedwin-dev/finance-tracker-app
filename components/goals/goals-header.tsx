import React from "react";
import {
	PlusIcon,
	BanknotesIcon,
	SparklesIcon,
	ChartBarIcon,
} from "@heroicons/react/24/solid";

export type GoalTab = "POTS" | "POCKETS" | "GOALS";

type Props = {
	activeTab: GoalTab;
	onTabChange: (tab: GoalTab) => void;
	onCreate: () => void;
};

const TABS: Array<{ key: GoalTab; label: string; Icon: any }> = [
	{ key: "POTS", label: "SPENDING POTS", Icon: BanknotesIcon },
	{ key: "POCKETS", label: "SAVING POCKETS", Icon: SparklesIcon },
	{ key: "GOALS", label: "FINANCIAL GOALS", Icon: ChartBarIcon },
];

export const GoalsHeader: React.FC<Props> = ({ activeTab, onTabChange, onCreate }) => (
	<>
		<div className="flex justify-between items-center px-1 pt-6">
			<h1 className="text-3xl font-black text-white tracking-tighter">
				LIMITS & GOALS
			</h1>
			<button
				onClick={onCreate}
				className="w-10 h-10 bg-white text-black hover:bg-indigo-400 hover:text-white transition-all rounded-full flex items-center justify-center shadow-lg active:scale-95 group"
			>
				<PlusIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
			</button>
		</div>

		<div className="flex bg-gray-900/50 p-1 rounded-[1.25rem] border border-white/5 mb-8 shadow-2xl backdrop-blur-xl overflow-x-auto no-scrollbar">
			{TABS.map(({ key, label, Icon }) => (
				<button
					key={key}
					onClick={() => onTabChange(key)}
					className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-black text-[10px] tracking-widest min-w-30 ${
						activeTab === key
							? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
							: "text-gray-500 hover:text-white"
					}`}
				>
					<Icon className="w-3.5 h-3.5" /> {label}
				</button>
			))}
		</div>
	</>
);
