import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Subscription, SubscriptionFrequency } from "../types";
import type { TransactionFormState, TransactionFormActions } from "./useTransactionFormState";

const FREQUENCIES: Subscription["frequency"][] = [
	"DAILY",
	"WEEKLY",
	"MONTHLY",
	"YEARLY",
];

type Props = {
	form: TransactionFormState & TransactionFormActions;
	subscriptions: Subscription[];
};

export const TransactionFormSubscription = ({ form, subscriptions }: Props) => (
	<div className="space-y-3 bg-white/5 p-3 rounded-2xl border border-gray-800">
		<div className="flex items-center justify-between">
			<label className="text-xs font-medium text-gray-400 flex items-center gap-2">
				<ArrowPathIcon className="w-3.5 h-3.5" />
				Subscription
			</label>
			{!form.subscriptionId && (
				<button
					type="button"
					onClick={() => form.setIsSubscription(!form.isSubscription)}
					className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
						form.isSubscription
							? "bg-primary/20 text-primary border border-primary/30"
							: "text-gray-500 border border-gray-800"
					}`}
				>
					{form.isSubscription ? "CREATE NEW" : "SET AS REPEATING"}
				</button>
			)}
		</div>

		{form.isSubscription && !form.subscriptionId && (
			<div className="animate-fadeIn space-y-3">
				<div className="flex gap-2">
					{FREQUENCIES.map((f: SubscriptionFrequency) => (
						<button
							key={f}
							type="button"
							onClick={() => form.setFrequency(f)}
							className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg border transition-all ${
								form.frequency === f
									? "bg-primary border-primary text-white"
									: "bg-surface border-gray-700 text-gray-400"
							}`}
						>
							{f}
						</button>
					))}
				</div>
				<p className="text-[10px] text-gray-500 italic">
					This will create a new subscription starting from {form.date}.
				</p>
			</div>
		)}

		{subscriptions.length > 0 && !form.isSubscription && (
			<div className="relative">
				<select
					value={form.subscriptionId}
					onChange={(e) => {
						const subId = e.target.value;
						form.setSubscriptionId(subId);
						if (subId) {
							const sub = subscriptions.find((s) => s.id === subId);
							if (sub) form.applySubscription(sub);
						}
					}}
					className="w-full bg-surface border border-gray-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-primary appearance-none"
				>
					<option value="">Link existing subscription...</option>
					{subscriptions.map((sub) => (
						<option key={sub.id} value={sub.id}>
							{sub.name} ({sub.currency} {sub.amount.toLocaleString()}) -{" "}
							{sub.frequency}
						</option>
					))}
				</select>
				{form.subscriptionId && (
					<button
						type="button"
						onClick={() => form.setSubscriptionId("")}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
					>
						<XMarkIcon className="w-4 h-4" />
					</button>
				)}
			</div>
		)}
	</div>
);
