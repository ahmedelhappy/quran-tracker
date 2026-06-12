import { useTranslation } from 'react-i18next';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, isDanger = false }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 z-10">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{title}</h3>
        <p className="text-[#4A4A4A] text-sm leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-[#4A4A4A] hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 rounded-lg font-medium text-sm text-white transition-colors ${
              isDanger ? 'bg-[#E63946] hover:bg-red-700' : 'bg-[#1B4332] hover:bg-[#2D6A4F]'
            }`}
          >
            {confirmText ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
