'use client';

import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle2, AlertCircle, X, Loader2, ExternalLink, ShieldCheck } from 'lucide-react';

interface CloudflareStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const CloudflareStorageModal: React.FC<CloudflareStorageModalProps> = ({
  isOpen,
  onClose,
  onConnected,
}) => {
  const [accountId, setAccountId] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [bucketName, setBucketName] = useState('');
  const [publicUrl, setPublicUrl] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingCurrent, setIsCheckingCurrent] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch current status on open
  useEffect(() => {
    if (!isOpen) return;
    setIsCheckingCurrent(true);
    setError(null);
    setSuccessMessage(null);

    fetch('/api/r2/status')
      .then(res => res.json())
      .then(data => {
        setCurrentStatus(data);
        if (data.configured) {
          setBucketName(data.bucket || '');
          if (data.publicUrl && !data.publicUrl.includes('Internal media')) {
            setPublicUrl(data.publicUrl);
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsCheckingCurrent(false));
  }, [isOpen]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      setError('Please fill in Account ID, Access Key ID, Secret Access Key, and Bucket Name.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/r2/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          accessKeyId,
          secretAccessKey,
          bucketName,
          publicUrl: publicUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Connection to Cloudflare R2 failed');
      }

      const syncInfo = data.synced;
      const detailStr = syncInfo
        ? ` Synced ${syncInfo.thumbnailsCount ?? 0} thumbnails, ${syncInfo.boardsCount ?? 0} boards, categories & profile.`
        : '';
      setSuccessMessage(data.message || `Successfully connected to Cloudflare R2!${detailStr}`);
      setCurrentStatus({
        configured: true,
        bucket: bucketName,
        connection: { ok: true },
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('thumbfeed_r2_synced', { detail: data.synced }));
      }

      if (onConnected) onConnected();

      // Automatically close after brief success display
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please verify your Cloudflare credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-blur">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0F1117] border border-white/10 p-6 shadow-2xl text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Connect Cloudflare R2 Storage</h2>
              <p className="text-xs text-white/50">Store thumbnails and previews in your Cloudflare bucket</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Indicator */}
        <div className="my-4 p-3 rounded-xl border bg-white/[0.02] flex items-center justify-between text-xs border-white/[0.08]">
          <span className="text-white/60">Current Status:</span>
          {isCheckingCurrent ? (
            <span className="flex items-center gap-1.5 text-white/40">
              <Loader2 className="w-3 h-3 animate-spin" /> Checking...
            </span>
          ) : currentStatus?.configured ? (
            <span className="flex items-center gap-1.5 font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected to &quot;{currentStatus.bucket}&quot;
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5" /> Credentials Needed
            </span>
          )}
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleConnect} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-white/70 font-medium mb-1">
              Cloudflare Account ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. 10f56e78581e96288edbb3e87d59bf87"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder:text-white/25 focus:border-orange-500/60 focus:bg-white/[0.06] outline-none font-mono text-xs transition-colors"
            />
            <span className="text-[10px] text-white/40 block mt-1">
              Found on your Cloudflare Dashboard &rarr; R2 &rarr; Overview (right sidebar).
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-white/70 font-medium mb-1">
                Access Key ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="24-32 hex characters"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder:text-white/25 focus:border-orange-500/60 focus:bg-white/[0.06] outline-none font-mono text-xs transition-colors"
              />
            </div>

            <div>
              <label className="block text-white/70 font-medium mb-1">
                Secret Access Key <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                required
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                placeholder="Secret key"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder:text-white/25 focus:border-orange-500/60 focus:bg-white/[0.06] outline-none font-mono text-xs transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-white/70 font-medium mb-1">
                R2 Bucket Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="e.g. thumbfeed or thumbnails"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder:text-white/25 focus:border-orange-500/60 focus:bg-white/[0.06] outline-none font-mono text-xs transition-colors"
              />
            </div>

            <div>
              <label className="block text-white/70 font-medium mb-1">
                Public URL Domain <span className="text-white/40 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                placeholder="e.g. https://pub-xxx.r2.dev"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder:text-white/25 focus:border-orange-500/60 focus:bg-white/[0.06] outline-none font-mono text-xs transition-colors"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <a
              href="https://dash.cloudflare.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/80 transition-colors"
            >
              <span>Cloudflare Dashboard</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg border border-white/10 hover:bg-white/[0.06] text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Test & Connect R2</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
