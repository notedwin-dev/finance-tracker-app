import React from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";

type Props = {
	neuralVault: string;
	suggestions: string[];
	onSelectSuggestion: (suggestion: string) => void;
};

export const EmptyChatState: React.FC<Props> = ({
	neuralVault,
	suggestions,
	onSelectSuggestion,
}) => (
	<div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center space-y-8 animate-slideUp">
		<div className="w-32 h-32 bg-primary/10 rounded-4xl flex items-center justify-center rotate-3 overflow-hidden border border-white/5 shadow-2xl">
			<img
				src={neuralVault}
				alt="AI Assistant"
				className="w-full h-full object-cover"
			/>
		</div>
		<div>
			<h3 className="text-2xl font-black text-white mb-2">
				How can I help you today?
			</h3>
			<p className="text-gray-400 text-sm px-4">
				I can analyze your spending, check your budget limits, or help you plan
				your savings goals.
			</p>
		</div>
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
			{suggestions.map((s, i) => (
				<button
					key={i}
					onClick={() => onSelectSuggestion(s)}
					className="text-left p-4 bg-surface border border-gray-800 rounded-2xl text-xs sm:text-sm text-gray-300 hover:border-primary/50 transition-all hover:bg-primary/5 shadow-sm"
				>
					{s}
				</button>
			))}
		</div>
	</div>
);

export const ChatLoadingBubble: React.FC = () => (
	<div className="flex justify-start animate-pulse">
		<div className="bg-surface border border-primary/20 text-gray-400 rounded-2xl rounded-tl-none p-4 flex items-center gap-3 shadow-lg shadow-primary/5">
			<div className="relative">
				<SparklesIcon className="w-5 h-5 text-primary" />
				<div className="absolute inset-0 bg-primary/40 blur-xl rounded-full" />
			</div>
			<div className="flex flex-col">
				<span className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">
					ZenFinance AI
				</span>
				<span className="text-xs text-gray-300 font-medium">
					Analyzing your data...
				</span>
			</div>
		</div>
	</div>
);
