import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  X,
  UploadCloud,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2,
  FileImage,
  ShieldAlert,
} from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import {
  analyzeDamageImage,
  validateImageFile,
  DamageVisionResponse,
  DamageVisionError,
  DamageSeverity,
} from '../../services/inbound/damageVisionApi';

interface DamageVisionModalProps {
  onClose: () => void;
}

export function formatGeneratedTime(isoStr: string): string {
  if (!isoStr) return '';
  const parsed = Date.parse(isoStr);
  if (isNaN(parsed)) return isoStr;
  const d = new Date(parsed);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dd = pad(d.getUTCDate());
  const mm = pad(d.getUTCMonth() + 1);
  const yyyy = d.getUTCFullYear();
  const hh = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  return `${dd}/${mm}/${yyyy} ${hh}:${min} UTC`;
}

export default function DamageVisionModal({ onClose }: DamageVisionModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DamageVisionResponse | null>(null);
  const [error, setError] = useState<DamageVisionError | null>(null);

  const titleId = useId();

  // Helper to safely replace preview URL and revoke old one
  const updatePreview = (file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (file) {
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSelectFile = (file: File | null) => {
    // Abort any in-flight analysis when file changes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setResult(null);
    setError(null);

    if (!file) {
      setSelectedFile(null);
      updatePreview(null);
      return;
    }

    try {
      validateImageFile(file);
      setSelectedFile(file);
      updatePreview(file);
    } catch (err: unknown) {
      setSelectedFile(null);
      updatePreview(null);
      setError(err as DamageVisionError);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleSelectFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isLoading) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      setError({
        status: 400,
        code: 'VALIDATION_MULTIPLE_FILES',
        kind: 'validation',
        message: t('f4.damageVision.errors.singleFileOnly', {
          defaultValue: 'Please select only one image at a time.',
        }),
      });
      return;
    }

    handleSelectFile(files[0]);
  };

  const handleClearImage = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedFile(null);
    updatePreview(null);
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const data = await analyzeDamageImage(selectedFile, controller.signal);
      setResult(data);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return;
      }
      setError(err as DamageVisionError);
      setResult(null);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const getSeverityBadge = (severity: DamageSeverity) => {
    switch (severity) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            {t('f4.damageVision.severity.high', { defaultValue: 'AI Severity: High' })}
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            {t('f4.damageVision.severity.medium', { defaultValue: 'AI Severity: Medium' })}
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {t('f4.damageVision.severity.low', { defaultValue: 'AI Severity: Low' })}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto p-0 w-[calc(100%-2rem)] max-w-3xl max-h-[92dvh] rounded-2xl border border-slate-200 shadow-2xl backdrop:bg-slate-900/40 overflow-hidden"
    >
      <div className="flex flex-col max-h-[92dvh] bg-white">
        {/* Header */}
        <header className="p-5 border-b border-slate-200 flex gap-3 items-start shrink-0 bg-white">
          <span className="p-2.5 rounded-xl border border-purple-100 bg-purple-50 text-purple-600">
            <Eye className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-bold text-base text-slate-900 break-words">
              {t('f4.damageVision.title', { defaultValue: 'AI Damage Vision Inspection' })}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('f4.damageVision.subtitle', {
                defaultValue: 'Visual assessment of inbound goods and packaging condition using computer vision.',
              })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('f4.close', { defaultValue: 'Close' })}
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto min-h-0 space-y-5">
          {/* Persistent Advisory & Privacy Disclosure Banner */}
          <div
            role="note"
            className="flex items-start gap-3 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-950 leading-relaxed space-y-1.5"
          >
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-900">
                {t('f4.damageVision.advisoryTitle', {
                  defaultValue: 'Advisory Visual Assessment Only',
                })}
              </p>
              <p className="text-blue-800">
                {t('f4.damageVision.advisoryText', {
                  defaultValue:
                    'This AI assessment is based only on visible information in the uploaded image. Packaging damage does not necessarily mean the product inside is damaged. Verify physically before making receiving or inventory decisions.',
                })}
              </p>
              <p className="text-[11px] text-blue-700/90 pt-0.5">
                {t('f4.damageVision.privacyNotice', {
                  defaultValue:
                    'The selected image is sent to the configured AI provider for visual analysis. SmartWMS does not send SKU, supplier, warehouse, quantities, or user identity as part of this Damage Vision request.',
                })}
              </p>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {/* Upload / Drop Area */}
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 sm:p-10 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-purple-500 bg-purple-50/60'
                  : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/60 hover:border-slate-400'
              }`}
            >
              <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">
                {t('f4.damageVision.dropzoneTitle', {
                  defaultValue: 'Click to select or drag and drop an inspection photo',
                })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {t('f4.damageVision.supportedFormats', {
                  defaultValue: 'Supported formats: JPG, PNG, WEBP (Max 5 MiB)',
                })}
              </p>
            </div>
          ) : (
            /* Selected Image Preview & Control */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                {previewUrl && (
                  <div className="relative w-40 h-40 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt={selectedFile.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-mono text-slate-700 font-semibold break-all">
                    <FileImage className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>{selectedFile.name}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB ({selectedFile.type})
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t('f4.damageVision.changeImage', { defaultValue: 'Change image' })}
                    </ActionButton>
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      disabled={isLoading}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={handleClearImage}
                    >
                      {t('f4.damageVision.clearImage', { defaultValue: 'Clear' })}
                    </ActionButton>
                    <ActionButton
                      variant="primary"
                      size="sm"
                      disabled={isLoading}
                      icon={
                        isLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )
                      }
                      onClick={() => void handleAnalyze()}
                    >
                      {isLoading
                        ? t('f4.damageVision.analyzing', { defaultValue: 'Analyzing…' })
                        : t('f4.damageVision.analyzeButton', { defaultValue: 'Analyze Damage' })}
                    </ActionButton>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div role="status" className="p-8 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-purple-600 animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-700">
                {t('f4.damageVision.loadingText', {
                  defaultValue: 'AI vision model is inspecting the image for defects or damage…',
                })}
              </p>
            </div>
          )}

          {/* Error Message */}
          {!isLoading && error && (
            <div
              role="alert"
              className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 text-xs space-y-2"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-rose-900">
                    {t('f4.damageVision.errorTitle', {
                      defaultValue: 'Damage Inspection Failed',
                    })}
                  </p>
                  <p className="text-rose-700 mt-0.5">{error.message}</p>
                </div>
              </div>
              {selectedFile && (
                <div className="flex justify-end pt-1">
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => void handleAnalyze()}
                  >
                    {t('f4.refresh', { defaultValue: 'Retry' })}
                  </ActionButton>
                </div>
              )}
            </div>
          )}

          {/* Analysis Result */}
          {!isLoading && !error && result && (
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {t('f4.damageVision.resultHeader', { defaultValue: 'Inspection Findings' })}
                  </span>
                  {getSeverityBadge(result.analysis.severity)}
                </div>
                {result.generatedAt && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {t('f4.damageVision.generatedAt', {
                      time: formatGeneratedTime(result.generatedAt),
                      defaultValue: `Analysis generated: ${formatGeneratedTime(result.generatedAt)}`,
                    })}
                  </span>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">
                    {t('f4.damageVision.damageTypeLabel', { defaultValue: 'Damage Type:' })}
                  </span>
                  <p className="text-slate-900 font-medium bg-white p-2.5 rounded-lg border border-slate-200">
                    {result.analysis.damageType}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">
                    {t('f4.damageVision.descriptionLabel', {
                      defaultValue: 'Visual Assessment / Damage Description:',
                    })}
                  </span>
                  <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                    {result.analysis.damageDescription}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">
                    {t('f4.damageVision.recommendedActionLabel', {
                      defaultValue: 'AI Recommended Follow-up:',
                    })}
                  </span>
                  <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                    {result.analysis.actionRecommended}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 shrink-0">
          <ActionButton variant="secondary" onClick={onClose}>
            {t('f4.close', { defaultValue: 'Close' })}
          </ActionButton>
        </footer>
      </div>
    </dialog>
  );
}
