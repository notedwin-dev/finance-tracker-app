import React from "react";

type Props = {
	isSubmitting: boolean;
	isEditing: boolean;
	canDelete: boolean;
	onSubmit: () => void;
	onDelete: () => void;
};

export const AccountFormFooter = ({
	isSubmitting,
	isEditing,
	canDelete,
	onSubmit,
	onDelete,
}: Props) => (
	<div className="p-5 border-t border-gray-800 space-y-3">
		<button
			type="button"
			onClick={onSubmit}
			disabled={isSubmitting}
			className={`w-full text-white font-bold py-3 rounded-xl transition-all shadow-lg ${
				isSubmitting
					? "bg-gray-600 cursor-not-allowed"
					: "bg-primary hover:bg-primaryDark shadow-indigo-500/20"
			}`}
		>
			{isSubmitting ? "Saving..." : isEditing ? "Update Asset" : "Add Asset"}
		</button>
		{isEditing && canDelete && (
			<button
				type="button"
				onClick={onDelete}
				className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-3 rounded-xl transition-all border border-red-500/20"
			>
				Delete Asset
			</button>
		)}
	</div>
);
