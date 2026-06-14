import React from "react";

type EmptyTabStateProps = {
	icon: React.ReactNode;
	message: string;
};

export const EmptyTabState: React.FC<EmptyTabStateProps> = ({
	icon,
	message,
}) => (
	<div className="col-span-full py-20 text-center bg-gray-900/40 rounded-[2.5rem] border border-gray-800/60 backdrop-blur-md">
		<div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
			{icon}
		</div>
		<p className="text-xs font-black text-gray-500 uppercase tracking-widest">
			{message}
		</p>
	</div>
);
