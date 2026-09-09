import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, Image as ImageIcon, FileText, Video, X, AlertCircle } from 'lucide-react';

interface MediaUploaderProps {
  mediaType: 'image' | 'video' | 'document';
  onUpload: (url: string, fileName?: string) => void;
  currentUrl: string;
  onClear: () => void;
}

export default function MediaUploader({ mediaType, onUpload, currentUrl, onClear }: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get accepted types for file input
  const getAcceptTypes = () => {
    switch (mediaType) {
      case 'image':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'document':
        return '.pdf,.doc,.docx,.xls,.xlsx,.txt';
      default:
        return '*/*';
    }
  };

  // Convert bytes to human readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle the file parsing
  const processFile = (file: File) => {
    setError(null);

    // Validate type
    const fileType = file.type;
    if (mediaType === 'image' && !fileType.startsWith('image/')) {
      setError('Please upload an image file (e.g. JPG, PNG, WEBP).');
      return;
    }
    if (mediaType === 'video' && !fileType.startsWith('video/')) {
      setError('Please upload a video file (e.g. MP4, WEBM).');
      return;
    }
    if (mediaType === 'document' && !fileType.startsWith('application/') && !fileType.startsWith('text/')) {
      setError('Please upload a document file (e.g. PDF, DOCX, XLSX).');
      return;
    }

    // Limit base64 conversion to 4MB to prevent Firestore limits and browser crash issues
    const maxSizeBytes = 4 * 1024 * 1024; 
    if (file.size > maxSizeBytes) {
      setError(`File is too large (${formatBytes(file.size)}). Maximum limit is 4MB.`);
      return;
    }

    setFileName(file.name);
    setFileSize(formatBytes(file.size));

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        onUpload(result, file.name);
      } else {
        setError('Failed to read file content.');
      }
    };
    reader.onerror = () => {
      setError('Error reading file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  const getMediaIcon = () => {
    switch (mediaType) {
      case 'image':
        return <ImageIcon className="w-8 h-8 text-emerald-500" />;
      case 'video':
        return <Video className="w-8 h-8 text-blue-500" />;
      case 'document':
        return <FileText className="w-8 h-8 text-amber-500" />;
    }
  };

  const isBase64 = currentUrl.startsWith('data:');

  return (
    <div className="space-y-2">
      {currentUrl ? (
        <div className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
          <div className="flex items-center gap-3 overflow-hidden">
            {getMediaIcon()}
            <div className="truncate text-left">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block truncate">
                {fileName || (isBase64 ? `Uploaded ${mediaType}` : 'Custom URL File')}
              </span>
              <span className="text-[10px] text-zinc-400 block">
                {fileSize || (isBase64 ? 'Ready to Send' : 'Linked Link')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClear();
              setFileName('');
              setFileSize('');
              setError(null);
            }}
            className="text-zinc-400 hover:text-red-500 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors shrink-0"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerSelect}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10'
              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={getAcceptTypes()}
            className="hidden"
          />
          
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-full mb-3">
            <Upload className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
          </div>

          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-center">
            Drag & Drop or <span className="text-emerald-600 dark:text-emerald-400 hover:underline">Browse</span>
          </p>
          <p className="text-[10px] text-zinc-400 mt-1 text-center capitalize">
            Supports {mediaType} (Max 4MB)
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-900/30">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
