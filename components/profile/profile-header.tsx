import React from "react";
import { PencilIcon } from "@heroicons/react/24/outline";
import type { UserProfile } from "../../types";
import { useMask } from "../../helpers/useMask";

type Props = {
	profile: UserProfile;
	isEditing: boolean;
	name: string;
	onStartEdit: () => void;
	onNameChange: (name: string) => void;
	onSave: () => void;
	onCancel: () => void;
};

export const ProfileHeader: React.FC<Props> = ({
	profile,
	isEditing,
	name,
	onStartEdit,
	onNameChange,
	onSave,
	onCancel,
}) => {
	const { maskText } = useMask();

	return (
		<div className="bg-surface sm:rounded-3xl border border-gray-800 overflow-hidden mb-6">
			<div className="h-24 bg-linear-to-r from-primary/20 to-secondary/20 relative">
				<div className="absolute -bottom-12 left-6">
					{profile.photoUrl ? (
						<img
							src={profile.photoUrl}
							alt="Profile"
							className="w-24 h-24 rounded-2xl border-4 border-surface shadow-xl"
						/>
					) : (
						<div className="w-24 h-24 rounded-2xl border-4 border-surface bg-slate-800 flex items-center justify-center text-4xl shadow-xl">
							👤
						</div>
					)}
				</div>
			</div>

			<div className="pt-16 pb-6 px-6">
				{isEditing ? (
					<div className="flex items-center gap-2">
						<input
							type="text"
							value={name}
							onChange={(e) => onNameChange(e.target.value)}
							className="bg-card text-xl font-bold text-white border-b-2 border-primary focus:outline-none py-1 flex-1"
							autoFocus
						/>
						<button
							onClick={onSave}
							className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg font-bold"
						>
							Save
						</button>
						<button
							onClick={onCancel}
							className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-lg font-bold"
						>
							Cancel
						</button>
					</div>
				) : (
					<div className="flex justify-between items-start">
						<div>
							<h2 className="text-2xl font-black text-white flex items-center gap-2">
								{maskText(profile.name)}
								<button
									onClick={onStartEdit}
									className="text-gray-500 hover:text-primary transition-colors"
								>
									<PencilIcon className="w-4 h-4" />
								</button>
							</h2>
							<p className="text-gray-500 text-sm font-medium">
								{maskText(profile.email)}
							</p>
						</div>
						<div className="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider border border-primary/20">
							Free Forever
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
