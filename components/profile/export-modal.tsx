import React from "react";
import Modal from "../Modal";
import DatePicker from "../DatePicker";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	startDate: string;
	endDate: string;
	onStartDateChange: (d: string) => void;
	onEndDateChange: (d: string) => void;
	onExport: () => void;
};

export const ExportModal: React.FC<Props> = ({
	isOpen,
	onClose,
	startDate,
	endDate,
	onStartDateChange,
	onEndDateChange,
	onExport,
}) => (
	<Modal isOpen={isOpen} onClose={onClose} title="Export Backup" maxWidth="max-w-sm">
		<div className="space-y-6">
			<div className="space-y-2">
				<p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
					Select Range (Optional)
				</p>
				<div className="space-y-3">
					<div className="space-y-1">
						<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">
							Start Date
						</label>
						<DatePicker
							value={startDate}
							onChange={onStartDateChange}
							placeholder="Earliest"
						/>
					</div>
					<div className="space-y-1">
						<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">
							End Date
						</label>
						<DatePicker
							value={endDate}
							onChange={onEndDateChange}
							placeholder="Latest"
						/>
					</div>
				</div>
				<p className="text-[10px] text-gray-600 italic mt-2">
					Note: If no dates are selected, all transactions will be exported.
					Accounts, Categories, and Goals are always included.
				</p>
			</div>

			<div className="flex flex-col gap-2 pt-2">
				<button
					onClick={() => {
						onExport();
						onClose();
					}}
					className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
				>
					Download JSON
				</button>
				<button
					onClick={() => {
						onStartDateChange("");
						onEndDateChange("");
					}}
					className="w-full py-2 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
				>
					Reset Filters
				</button>
			</div>
		</div>
	</Modal>
);
