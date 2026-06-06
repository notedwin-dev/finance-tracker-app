import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "../../types";
import { ShieldCheckIcon, PlusIcon } from "@heroicons/react/24/outline";

interface MessageBubbleProps {
	message: ChatMessage;
	isError: boolean;
	cleanText: string;
	suggestions: string[];
	onApproveTool: () => void;
	onRejectTool: () => void;
	onSuggestionClick: (suggestion: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
	message,
	isError,
	cleanText,
	suggestions,
	onApproveTool,
	onRejectTool,
	onSuggestionClick,
}) => {
	const isUser = message.role === "user";
	const timeStr = new Date(message.timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});

	const bubbleClass = isUser
		? "bg-primary text-white rounded-tr-none shadow-lg shadow-primary/10"
		: isError
			? "bg-red-500/10 border border-red-500/30 text-gray-200 rounded-tl-none"
			: "bg-surface border border-gray-800 text-gray-200 rounded-tl-none";

	const footerClass = isUser
		? "text-white/50"
		: isError
			? "text-red-500/50"
			: "text-gray-600";

	return (
		<div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
			<div
				className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 sm:p-5 ${bubbleClass}`}
			>
				{isUser ? (
					<div className="text-sm sm:text-base whitespace-pre-wrap wrap-break-word">
						{message.content}
					</div>
				) : (
					<div
						className={`prose prose-invert prose-sm max-w-none wrap-break-word prose-p:leading-relaxed prose-headings:text-white prose-headings:font-black ${
							isError
								? "prose-strong:text-red-400"
								: "prose-strong:text-primary"
						} prose-strong:font-bold prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10`}
					>
						<ReactMarkdown remarkPlugins={[remarkGfm]}>
							{cleanText}
						</ReactMarkdown>
					</div>
				)}

				{message.functionCall && (
					<ToolCallBlock
						functionCall={message.functionCall}
						status={message.status}
						onApprove={onApproveTool}
						onReject={onRejectTool}
					/>
				)}

				<p
					className={`text-[9px] mt-2 font-bold uppercase tracking-widest ${footerClass}`}
				>
					{timeStr}
				</p>
			</div>

			{!isUser && !isError && suggestions.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-2 max-w-[85%] sm:max-w-[75%]">
					{suggestions.map((suggestion, idx) => (
						<button
							key={idx}
							onClick={() => onSuggestionClick(suggestion)}
							className="text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 py-1.5 px-3 rounded-full transition-all flex items-center gap-1.5"
						>
							<PlusIcon className="w-3 h-3" />
							{suggestion}
						</button>
					))}
				</div>
			)}
		</div>
	);
};

interface ToolCallBlockProps {
	functionCall: { name: string; args?: Record<string, unknown> };
	status?: "pending" | "approved" | "rejected";
	onApprove: () => void;
	onReject: () => void;
}

const ToolCallBlock: React.FC<ToolCallBlockProps> = ({
	functionCall,
	status,
	onApprove,
	onReject,
}) => (
	<div className="mt-4 pt-4 border-t border-gray-800">
		<div className="flex items-center gap-2 mb-3">
			<ShieldCheckIcon className="w-4 h-4 text-primary" />
			<span className="text-xs font-bold text-white uppercase tracking-wider">
				Data Access Request
			</span>
		</div>
		<div className="bg-black/20 rounded-xl p-3 mb-4">
			<p className="text-xs text-gray-400 leading-relaxed mb-2">
				AI would like to use the tool
				<span className="text-primary font-bold mx-1">{functionCall.name}</span>
				with these parameters:
			</p>
			<div className="space-y-1">
				{Object.entries(functionCall.args || {}).map(([k, v]) => (
					<div
						key={k}
						className="flex items-center justify-between text-[10px]"
					>
						<span className="text-gray-500 font-medium">{k}:</span>
						<span className="text-primary font-bold">{String(v)}</span>
					</div>
				))}
			</div>
		</div>
		{status === "pending" ? (
			<div className="flex gap-2">
				<button
					onClick={onApprove}
					className="flex-1 bg-primary hover:bg-primary-dark text-white text-xs font-bold py-2 rounded-lg transition-all active:scale-95"
				>
					Approve
				</button>
				<button
					onClick={onReject}
					className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold py-2 rounded-lg transition-all active:scale-95"
				>
					Reject
				</button>
			</div>
		) : (
			<div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
				{status === "approved" ? (
					<span className="text-emerald-500">✓ Approved</span>
				) : (
					<span className="text-red-500">✕ Rejected</span>
				)}
			</div>
		)}
	</div>
);

export { MessageBubble, ToolCallBlock };
