import React from "react";
import { PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/solid";

interface Props {
  selectedCount: number;
  onBatchEdit: () => void;
  onBatchDelete: () => void;
  onClear: () => void;
}

const BatchActionBar: React.FC<Props> = ({
  selectedCount,
  onBatchEdit,
  onBatchDelete,
  onClear,
}) => {
  return (
    <div className="sticky top-20 lg:top-4 z-70 animate-fadeIn bg-indigo-600/70 backdrop-blur-xl shadow-2xl shadow-indigo-500/30 rounded-4xl p-3 sm:p-4 mb-8 flex items-center justify-between border border-white/20">
      <div className="flex items-center gap-3 pl-2 sm:pl-4">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-black text-sm sm:text-base">
          {selectedCount}
        </div>
        <p className="text-white font-black text-xs sm:text-sm uppercase tracking-widest hidden sm:block">
          Selected
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBatchEdit}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all"
        >
          <PencilIcon className="w-4 h-4" />
          Batch Edit
        </button>
        <button
          onClick={onBatchDelete}
          className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg"
        >
          <TrashIcon className="w-4 h-4" />
          Delete
        </button>
        <div className="w-px h-8 bg-white/10 mx-1" />
        <button
          onClick={onClear}
          className="p-2 sm:p-3 text-white/50 hover:text-white transition-colors"
        >
          <XMarkIcon className="w-5 sm:w-6 h-5 sm:h-6" />
        </button>
      </div>
    </div>
  );
};

export default BatchActionBar;
