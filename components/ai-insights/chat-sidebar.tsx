import React from "react";
import { ChatSession } from "../../types";
import {
	SparklesIcon,
	XMarkIcon,
	PlusIcon,
	ChatBubbleLeftRightIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";

type Props = {
	isOpen: boolean;
	isInline: boolean;
	sessions: ChatSession[];
	activeSessionId?: string;
	onNewChat: () => void;
	onSelectSession: (id: string) => void;
	onDeleteSession: (id: string) => void;
	onClose: () => void;
};

const sortByUpdatedDesc = (a: ChatSession, b: ChatSession) =>
	new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

export const ChatSidebar: React.FC<Props> = ({
	isOpen,
	isInline,
	sessions,
	activeSessionId,
	onNewChat,
	onSelectSession,
	onDeleteSession,
	onClose,
}) => (
	<div
		className={`${
			isOpen ? "translate-x-0" : "-translate-x-full"
		} ${isInline ? "lg:hidden" : "lg:translate-x-0"} ${
			isInline ? "absolute inset-y-0 left-0" : "fixed lg:static inset-y-0 left-0"
		} w-72 bg-surface border-r border-gray-800 z-50 transition-transform duration-300 flex flex-col`}
	>
		<div className="p-4 flex items-center justify-between border-b border-gray-800">
			<div className="flex items-center gap-2">
				<SparklesIcon className="w-5 h-5 text-primary" />
				<span className="font-bold text-white uppercase tracking-widest text-xs">
					ZenFinance AI
				</span>
			</div>
			<button
				onClick={onClose}
				className="lg:hidden p-1 text-gray-400 hover:text-white"
			>
				<XMarkIcon className="w-6 h-6" />
			</button>
		</div>

		<div className="p-4">
			<button
				onClick={() => {
					onNewChat();
					onClose();
				}}
				className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 p-3 rounded-xl transition-all font-bold text-sm"
			>
				<PlusIcon className="w-4 h-4" /> New Chat
			</button>
		</div>

		<div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
			{sessions.sort(sortByUpdatedDesc).map((s) => (
				<div
					key={s.id}
					onClick={() => {
						onSelectSession(s.id);
						onClose();
					}}
					className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
						activeSessionId === s.id
							? "bg-primary/20 text-white"
							: "text-gray-400 hover:bg-white/5"
					}`}
				>
					<div className="flex items-center gap-3 overflow-hidden">
						<ChatBubbleLeftRightIcon className="w-4 h-4 shrink-0" />
						<span className="text-sm truncate font-medium">{s.title}</span>
					</div>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onDeleteSession(s.id);
						}}
						className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
					>
						<TrashIcon className="w-4 h-4" />
					</button>
				</div>
			))}
		</div>
	</div>
);
