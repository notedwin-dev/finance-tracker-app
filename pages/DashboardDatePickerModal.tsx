import React from "react";
import DatePicker from "../components/DatePicker";

type Props = {
	isOpen: boolean;
	customRange: { start: string; end: string };
	onRangeChange: (range: { start: string; end: string }) => void;
	onClose: () => void;
	onApply: () => void;
};

export const DashboardDatePickerModal = ({
	isOpen,
	customRange,
	onRangeChange,
	onClose,
	onApply,
}: Props) => {
	if (!isOpen) return null;
	return (
		<div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4">
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div className="relative w-full max-w-sm bg-surface border-t sm:border border-gray-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-slideUp sm:animate-fadeIn">
				<h3 className="text-xl font-black text-white tracking-tight mb-6">
					Select Date Range
				</h3>

				<div className="space-y-6">
					<div>
						<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
							Start Date
						</label>
						<DatePicker
							value={customRange.start}
							onChange={(date) =>
								onRangeChange({ ...customRange, start: date })
							}
						/>
					</div>

					<div>
						<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
							End Date
						</label>
						<DatePicker
							value={customRange.end}
							onChange={(date) => onRangeChange({ ...customRange, end: date })}
						/>
					</div>

					<div className="pt-4 grid grid-cols-2 gap-4">
						<button
							type="button"
							onClick={onClose}
							className="px-6 py-4 rounded-2xl bg-gray-900 border border-gray-800 text-gray-400 font-bold hover:text-white transition-all"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={onApply}
							className="px-6 py-4 rounded-2xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
						>
							Apply
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
