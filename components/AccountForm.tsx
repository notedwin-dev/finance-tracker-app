import React, { useState, useEffect } from "react";
import { Account, ASSET_PROVIDERS } from "../types";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";
import { formatAccountBalance } from "../helpers/amount-calculator";
import { AccountFormHeader } from "./AccountFormHeader";
import { AccountFormAssetGrid } from "./AccountFormAssetGrid";
import { AccountFormIconSection } from "./AccountFormIconSection";
import { AccountFormNotes } from "./AccountFormNotes";
import { AccountFormFooter } from "./AccountFormFooter";

interface Props {
	initialAccount?: Account;
	accounts: Account[];
	onSave: (account: Omit<Account, "userId">) => Promise<void>;
	onDelete?: (id: string, name: string) => void;
	onClose: () => void;
}

const AccountForm: React.FC<Props> = ({
	initialAccount,
	accounts,
	onSave,
	onDelete,
	onClose,
}) => {
	const [activeTab, setActiveTab] = useState<"PRESETS" | "CUSTOM">("PRESETS");

	const [editingId, setEditingId] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [balance, setBalance] = useState("");
	const [currency, setCurrency] = useState<Account["currency"]>("MYR");
	const [type, setType] = useState<Account["type"]>("BANK");
	const [iconType, setIconType] = useState<Account["iconType"]>("EMOJI");
	const [iconValue, setIconValue] = useState("🏦");
	const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
		null,
	);
	const [note, setNote] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const sanitizeNote = (value: string) =>
		value
			.replace(/\b(cvv|cvc)\s*:?\s*\d{3,4}\b/gi, "[redacted]")
			.replace(/[\d -]+/g, (run) => {
				const digits = run.replace(/\D/g, "");
				return digits.length >= 13 && digits.length <= 19 ? "[redacted]" : run;
			});

	const [confirmationModal, setConfirmationModal] = useState<{
		isOpen: boolean;
		title: string;
		description: string;
		onConfirm: () => void;
		confirmLabel: string;
		isDestructive?: boolean;
	}>({
		isOpen: false,
		title: "",
		description: "",
		onConfirm: () => {},
		confirmLabel: "Confirm",
	});

	const handleBalanceChange = (val: string) => {
		setBalance(formatAccountBalance(val, balance, currency));
	};

	const loadAccountData = (acc: Account) => {
		setEditingId(acc.id);
		setName(acc.name);
		setBalance(acc.balance.toFixed(2));
		setCurrency(acc.currency);
		setType(acc.type);
		setIconType(acc.iconType);
		setIconValue(acc.iconValue);
		setSelectedProviderId(acc.providerId || null);
		setNote(acc.note || "");

		if (acc.providerId) setActiveTab("PRESETS");
		else if (acc.iconType === "EMOJI") setActiveTab("CUSTOM");
	};

	const resetForm = () => {
		setEditingId(null);
		setName("");
		setBalance("");
		setCurrency("MYR");
		setType("BANK");
		setIconType("EMOJI");
		setIconValue("🏦");
		setSelectedProviderId(null);
		setNote("");
		setActiveTab("PRESETS");
	};

	useEffect(() => {
		if (initialAccount) {
			loadAccountData(initialAccount);
		} else {
			resetForm();
		}
	}, [initialAccount]);

	const handleAssetSelect = (id: string) => {
		if (id === "NEW") {
			resetForm();
		} else {
			const acc = accounts.find((a) => a.id === id);
			if (acc) loadAccountData(acc);
		}
	};

	const handlePresetSelect = (provider: (typeof ASSET_PROVIDERS)[0]) => {
		setSelectedProviderId(provider.id);
		setName(provider.name);
		setType(provider.type as any);
		setIconType("IMAGE");
		setIconValue(provider.icon);
		if ((provider as any).currency) {
			setCurrency((provider as any).currency);
		} else if (provider.type === "CRYPTO") {
			setCurrency("USD");
		}
	};

	const handleSubmit = async () => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			await onSave({
				id: editingId || crypto.randomUUID(),
				name,
				balance: parseFloat(balance) || 0,
				currency,
				type,
				color: "bg-gradient-to-br from-gray-800 to-gray-900",
				iconType,
				iconValue,
				providerId: selectedProviderId || undefined,
				note: note || undefined,
			});
			onClose();
		} finally {
			setIsSubmitting(false);
		}
	};

	const requestDelete = () => {
		if (!editingId) return;
		setConfirmationModal({
			isOpen: true,
			title: "Delete Asset",
			description: `Are you sure you want to delete ${name}? This will remove it from your holdings.`,
			confirmLabel: "Delete",
			isDestructive: true,
			onConfirm: () => {
				onDelete?.(editingId, name);
				onClose();
			},
		});
	};

	return (
		<div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 md:p-6 animate-fadeIn">
			<div className="w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl border-t sm:border border-gray-800 shadow-2xl flex flex-col h-[90vh] sm:h-auto max-h-[95vh] overflow-hidden animate-slideUp sm:animate-fadeIn">
				<AccountFormHeader
					editingId={editingId}
					accounts={accounts}
					onClose={onClose}
					onAssetSelect={handleAssetSelect}
				/>

				<div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-5 sm:space-y-6 pb-20 sm:pb-5">
					<div className="flex p-1 bg-surface rounded-lg">
						<button
							type="button"
							onClick={() => setActiveTab("PRESETS")}
							className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "PRESETS" ? "bg-primary text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
						>
							Popular Assets
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("CUSTOM")}
							className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "CUSTOM" ? "bg-primary text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
						>
							Custom
						</button>
					</div>

					{activeTab === "PRESETS" && (
						<AccountFormAssetGrid
							selectedProviderId={selectedProviderId}
							onSelect={handlePresetSelect}
						/>
					)}

					<div className="space-y-4">
						<div>
							<label className="block text-xs font-medium text-gray-500 mb-1">
								Asset Name
							</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white focus:border-primary focus:outline-none"
								placeholder="e.g. Main Savings"
								required
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-xs font-medium text-gray-500 mb-1">
									Balance
								</label>
								<input
									type="text"
									inputMode="decimal"
									value={balance}
									onChange={(e) => handleBalanceChange(e.target.value)}
									className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white font-bold text-lg focus:border-primary focus:outline-none"
									placeholder="0.00"
									required
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-gray-500 mb-1">
									Currency / Symbol
								</label>
								<div className="relative group">
									<input
										type="text"
										value={currency}
										onChange={(e) => setCurrency(e.target.value.toUpperCase())}
										className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white focus:border-primary focus:outline-none pr-12 font-bold uppercase"
										placeholder="MYR"
										list="currency-options"
									/>
									<datalist id="currency-options">
										<option value="MYR" />
										<option value="USD" />
										<option value="BTC" />
										<option value="ETH" />
										<option value="USDT" />
										<option value="TRX" />
									</datalist>
									<div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-[10px] font-bold">
										SYMBOL
									</div>
								</div>
							</div>
						</div>

						{activeTab === "CUSTOM" && (
							<AccountFormIconSection
								iconType={iconType}
								iconValue={iconValue}
								onIconTypeChange={setIconType}
								onIconValueChange={setIconValue}
							/>
						)}

						<AccountFormNotes
							note={note}
							onNoteChange={(v) => setNote(sanitizeNote(v))}
						/>
					</div>
				</div>

				<AccountFormFooter
					isSubmitting={isSubmitting}
					isEditing={!!editingId}
					canDelete={!!onDelete}
					onSubmit={handleSubmit}
					onDelete={requestDelete}
				/>
			</div>

			<Modal
				isOpen={confirmationModal.isOpen}
				onClose={() =>
					setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
				}
				title={confirmationModal.title}
				description={confirmationModal.description}
				icon={confirmationModal.isDestructive ? XMarkIcon : undefined}
				iconColor={
					confirmationModal.isDestructive ? "text-rose-400" : "text-primary"
				}
				iconBgColor={
					confirmationModal.isDestructive ? "bg-rose-500/10" : "bg-primary/10"
				}
			>
				<div className="grid grid-cols-2 gap-3">
					<button
						type="button"
						onClick={() =>
							setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
						}
						className="py-3 px-4 rounded-xl font-bold text-sm bg-surface border border-gray-700 hover:bg-gray-800 text-gray-400 transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => {
							confirmationModal.onConfirm();
							setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
						}}
						className={`py-3 px-4 rounded-xl font-bold text-sm transition-colors shadow-lg ${
							confirmationModal.isDestructive
								? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 text-white"
								: "bg-primary hover:bg-primaryDark shadow-primary/20 text-white"
						}`}
					>
						{confirmationModal.confirmLabel}
					</button>
				</div>
			</Modal>
		</div>
	);
};

export default AccountForm;
