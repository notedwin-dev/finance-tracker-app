import React from "react";

type Props = {
	note: string;
	onNoteChange: (value: string) => void;
};

export const AccountFormNotes = ({ note, onNoteChange }: Props) => (
	<div className="border-t border-gray-800 pt-4 mt-2">
		<h3 className="text-sm font-bold text-white mb-3">Notes</h3>
		<textarea
			value={note}
			onChange={(e) => onNoteChange(e.target.value)}
			className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-primary focus:outline-none"
			placeholder="Optional notes (e.g. payment reference, internal memo)"
			rows={2}
		/>
	</div>
);
