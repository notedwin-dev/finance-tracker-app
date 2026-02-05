import React, { useState, useRef } from "react";
import Modal from "./Modal";
import {
  CloudArrowUpIcon,
  DocumentArrowUpIcon,
  TableCellsIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  SparklesIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { parseBankStatement } from "../services/gemini.services";
import { Transaction, TransactionType } from "../types";
import { useAuth } from "../services/auth.services";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  onImport: (
    transactions: Partial<Transaction>[],
    isHistorical: boolean,
  ) => Promise<void>;
}

const BulkImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  accountId,
  onImport,
}) => {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isHistorical, setIsHistorical] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<
    Partial<Transaction>[]
  >([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const reset = () => {
    setFile(null);
    setIsParsing(false);
    setError(null);
    setParsedTransactions([]);
    setIsFinalizing(false);
    setEditingIdx(null);
  };

  const updateTransaction = (idx: number, updates: Partial<Transaction>) => {
    setParsedTransactions((prev) =>
      prev.map((tx, i) => (i === idx ? { ...tx, ...updates } : tx)),
    );
  };

  const removeTransaction = (idx: number) => {
    setParsedTransactions((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
    else if (editingIdx !== null && editingIdx > idx)
      setEditingIdx(editingIdx - 1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleStartParsing = async () => {
    if (!file) return;

    setIsParsing(true);
    setError(null);

    try {
      const base64 = await readFileAsBase64(file);
      const results = await parseBankStatement(
        profile.geminiApiKey || "",
        base64,
        file.type,
      );
      setParsedTransactions(results);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message ||
          "Failed to parse the bank statement. Please try a different file.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedTransactions.length === 0) return;

    setIsFinalizing(true);
    try {
      await onImport(parsedTransactions, isHistorical);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to import transactions.");
      setIsFinalizing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Statement Import"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {!file && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <DocumentArrowUpIcon className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">
                Upload Bank Statement or CSV
              </p>
              <p className="text-gray-500 text-sm mt-1">
                PDF, CSV or Image files supported (Gemini AI Vision)
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="application/pdf,image/*,text/csv,.csv"
              onChange={handleFileChange}
            />
          </div>
        )}

        {file && parsedTransactions.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                  <DocumentArrowUpIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white font-bold">{file.name}</p>
                  <p className="text-gray-500 text-xs">
                    {(file.size / 1024).toFixed(1)} KB • Ready to parse
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                <ExclamationCircleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleStartParsing}
              disabled={isParsing}
              className="w-full py-4 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black flex items-center justify-center gap-3 transition-all"
            >
              {isParsing ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  AI is analyzing statement...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" />
                  Analyze with ZenFinance AI
                </>
              )}
            </button>
          </div>
        )}

        {parsedTransactions.length > 0 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-black uppercase tracking-widest text-xs">
                Parsed Transactions ({parsedTransactions.length})
              </h4>
              <button
                onClick={reset}
                className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
              >
                Clear Results
              </button>
            </div>

            <div className="max-h-75 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
              {parsedTransactions.map((tx, idx) => (
                <div
                  key={idx}
                  className={`bg-white/5 border rounded-2xl p-4 transition-all ${
                    editingIdx === idx
                      ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                      : "border-white/5"
                  }`}
                >
                  {editingIdx === idx ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">
                            Name
                          </label>
                          <input
                            type="text"
                            value={tx.shopName}
                            onChange={(e) =>
                              updateTransaction(idx, {
                                shopName: e.target.value,
                              })
                            }
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={tx.date}
                            onChange={(e) =>
                              updateTransaction(idx, { date: e.target.value })
                            }
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">
                            Amount ({tx.currency})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={tx.amount}
                            onChange={(e) =>
                              updateTransaction(idx, {
                                amount: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">
                            Type
                          </label>
                          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                            <button
                              type="button"
                              onClick={() =>
                                updateTransaction(idx, {
                                  type: TransactionType.EXPENSE,
                                })
                              }
                              className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${
                                tx.type === TransactionType.EXPENSE
                                  ? "bg-rose-500 text-white shadow-lg"
                                  : "text-gray-500 hover:text-white"
                              }`}
                            >
                              EXPENSE
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateTransaction(idx, {
                                  type: TransactionType.INCOME,
                                })
                              }
                              className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${
                                tx.type === TransactionType.INCOME
                                  ? "bg-emerald-500 text-white shadow-lg"
                                  : "text-gray-500 hover:text-white"
                              }`}
                            >
                              INCOME
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-white/10">
                        <button
                          onClick={() => removeTransaction(idx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors text-[10px] font-black uppercase tracking-widest"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          Delete
                        </button>
                        <button
                          onClick={() => setEditingIdx(null)}
                          className="px-4 py-1.5 rounded-lg bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-bold text-sm truncate">
                          {tx.shopName}
                        </p>
                        <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mt-0.5">
                          {tx.date}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-4">
                        <div>
                          <p
                            className={`font-black text-sm ${
                              tx.type === TransactionType.INCOME
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {tx.type === TransactionType.INCOME ? "+" : "-"}{" "}
                            {tx.amount?.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}{" "}
                            {tx.currency}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 border-l border-white/10 pl-3">
                          <button
                            onClick={() => setEditingIdx(idx)}
                            className="p-2 text-gray-500 hover:text-primary transition-colors hover:bg-primary/10 rounded-lg group"
                            title="Edit"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeTransaction(idx)}
                            className="p-2 text-gray-500 hover:text-rose-500 transition-colors hover:bg-rose-500/10 rounded-lg"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isHistorical"
                  checked={isHistorical}
                  onChange={(e) => setIsHistorical(e.target.checked)}
                  className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary"
                />
                <label
                  htmlFor="isHistorical"
                  className="text-sm font-bold text-amber-200 cursor-pointer"
                >
                  Historical Import (Do not adjust current balance)
                </label>
              </div>
              <p className="text-[11px] text-amber-200/60 leading-relaxed font-medium pl-8">
                Check this if these transactions are from the past. It will add
                them to your history but won't change your current real-time
                account balance.
              </p>
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={isFinalizing}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl font-black flex items-center justify-center gap-3 transition-all"
            >
              {isFinalizing ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircleIcon className="w-6 h-6" />
              )}
              Confirm Import to Account
            </button>
          </div>
        )}

        <div className="flex items-start gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
          <CloudArrowUpIcon className="w-5 h-5 text-indigo-400 shrink-0" />
          <p className="text-[11px] text-indigo-300 leading-relaxed font-medium">
            ZenFinance AI uses Gemini 2.5 Vision to securely read your
            statement. Data is used only to convert the file into structured
            transactions and is not saved on any servers.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default BulkImportModal;
