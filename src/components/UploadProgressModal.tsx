import React from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadProgressModalProps {
  isOpen: boolean;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  message: string;
  totalProxies?: number;
  processedProxies?: number;
}

const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  isOpen,
  progress,
  status,
  message,
  totalProxies = 0,
  processedProxies = 0
}) => {
  if (!isOpen) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return <Upload className="h-8 w-8 text-blue-600 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-600" />;
      default:
        return <Upload className="h-8 w-8 text-blue-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'uploading':
        return 'bg-blue-600';
      case 'success':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity" />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-center shadow-2xl transition-all w-full max-w-md animate-[modal-appear_0.3s_ease-out]">
          {/* Content */}
          <div className="bg-white px-6 py-8">
            {/* Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-6">
              {getStatusIcon()}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {status === 'uploading' && 'Uploading Proxies...'}
              {status === 'success' && 'Upload Complete!'}
              {status === 'error' && 'Upload Failed'}
            </h3>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className={`h-3 rounded-full transition-all duration-300 ease-out ${getStatusColor()}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Progress Text */}
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {Math.round(progress)}%
              </div>
              <div className="text-sm text-gray-600">
                {status === 'uploading' && `${processedProxies} / ${totalProxies} proxies processed`}
                {status === 'success' && `${totalProxies} proxies uploaded successfully`}
                {status === 'error' && 'Please try again'}
              </div>
            </div>

            {/* Message */}
            <p className="text-sm text-gray-500 mb-6">
              {message}
            </p>

            {/* Animated dots for uploading */}
            {status === 'uploading' && (
              <div className="flex justify-center space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            )}

            {/* Success/Error state - auto close indicator */}
            {(status === 'success' || status === 'error') && (
              <div className="text-xs text-gray-400">
                This dialog will close automatically in a few seconds
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadProgressModal;