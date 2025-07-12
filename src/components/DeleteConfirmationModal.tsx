import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  type?: 'danger' | 'warning';
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  type = 'danger'
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (confirmationText.toLowerCase() !== 'delete all') {
      return;
    }

    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error during deletion:', error);
    } finally {
      setIsDeleting(false);
      setConfirmationText('');
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmationText('');
      onClose();
    }
  };

  const isConfirmDisabled = confirmationText.toLowerCase() !== 'delete all' || isDeleting;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all w-full max-w-md animate-[modal-appear_0.3s_ease-out]"
        >
          {/* Header */}
          <div className="bg-red-50 px-6 py-4 border-b border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-red-100 rounded-full p-2">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-red-900">{title}</h3>
              </div>
              {!isDeleting && (
                <button
                  onClick={handleClose}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-6">
            {/* Warning Icon and Message */}
            <div className="mb-6">
              <div className="flex items-start space-x-4">
                <div className="bg-yellow-100 rounded-full p-3 flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Are you absolutely sure?
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {message}
                  </p>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <Trash2 className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Danger Zone</span>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• This action cannot be undone</li>
                <li>• All proxy data will be permanently deleted</li>
                <li>• Users will not be able to generate new IPs until proxies are re-uploaded</li>
                <li>• This will affect all users immediately</li>
              </ul>
            </div>

            {/* Confirmation Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE ALL</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type DELETE ALL here"
                disabled={isDeleting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{confirmText}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;