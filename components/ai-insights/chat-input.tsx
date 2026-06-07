import React from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";

type Props = {
	query: string;
	loading: boolean;
	onQueryChange: (q: string) => void;
	onSubmit: (e: React.FormEvent) => void;
};

const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
	e.target.style.height = "auto";
	e.target.style.height = e.target.scrollHeight + "px";
};

const handleKeyDown = (
	e: React.KeyboardEvent<HTMLTextAreaElement>,
	onSubmit: () => void,
) => {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		onSubmit();
	}
};

export const ChatInput: React.FC<Props> = ({
	query,
	loading,
	onQueryChange,
	onSubmit,
}) => (
	<div className="p-4 sm:p-6 bg-linear-to-t from-background via-background to-transparent shrink-0">
		<form
			onSubmit={onSubmit}
			className="max-w-4xl mx-auto relative group"
		>
			<textarea
				rows={1}
				value={query}
				onChange={(e) => {
					onQueryChange(e.target.value);
					autoResize(e);
				}}
				onKeyDown={(e) => handleKeyDown(e, () => onSubmit(e as any))}
				placeholder="Type your message..."
				disabled={loading}
				className="w-full bg-surface border border-gray-800 focus:border-primary rounded-2xl py-4 pl-5 pr-14 text-white focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none max-h-48 custom-scrollbar shadow-2xl"
			/>
			<button
				type="submit"
				disabled={loading || !query.trim()}
				className="absolute right-3 bottom-3 p-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95 flex items-center justify-center min-w-10 min-h-10"
			>
				{loading ? (
					<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
				) : (
					<PaperAirplaneIcon className="w-5 h-5" />
				)}
			</button>
		</form>
		<p className="text-[10px] text-gray-600 text-center mt-3 font-medium uppercase tracking-widest">
			ZenFinance AI can make mistakes. Always verify important calculations.
		</p>
	</div>
);
