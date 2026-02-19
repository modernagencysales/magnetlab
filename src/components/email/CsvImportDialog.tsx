'use client';

import { useState, useRef } from 'react';
import { Loader2, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface ValidRow {
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface InvalidRow {
  row: number;
  email: string;
  reason: string;
}

interface PreviewData {
  valid: ValidRow[];
  invalid: InvalidRow[];
  total: number;
  file: File;
}

interface ImportResult {
  imported: number;
  skipped: number;
}

type Step = 'upload' | 'preview' | 'result';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CsvImportDialog({ open, onOpenChange, onSuccess }: CsvImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetDialog = () => {
    setStep('upload');
    setUploading(false);
    setImporting(false);
    setError(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/email/subscribers/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse CSV');
      }

      setPreview({
        valid: data.valid,
        invalid: data.invalid,
        total: data.total,
        file,
      });
      setStep('preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse CSV';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.file) return;

    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', preview.file);

      const response = await fetch('/api/email/subscribers/import?confirm=true', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import subscribers');
      }

      setResult({
        imported: data.imported,
        skipped: data.skipped,
      });
      setStep('result');
      toast.success(`Imported ${data.imported} subscriber${data.imported === 1 ? '' : 's'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import subscribers';
      setError(message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
    if (step === 'result') {
      onSuccess();
    }
  };

  const handleDone = () => {
    resetDialog();
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) {
        if (step === 'result') onSuccess();
        resetDialog();
      }
      onOpenChange(value);
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Import Subscribers'}
            {step === 'preview' && 'Preview Import'}
            {step === 'result' && 'Import Complete'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file with an "email" column. Optional columns: first_name, last_name.'}
            {step === 'preview' && 'Review the parsed data before importing.'}
            {step === 'result' && 'Your import has been processed.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="flex-1"
              />
              <Button
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload
              </Button>
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                {preview.valid.length} valid
              </span>
              {preview.invalid.length > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {preview.invalid.length} invalid
                </span>
              )}
            </div>

            {/* Valid rows preview (first 10) */}
            {preview.valid.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">First Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Last Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.valid.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="px-3 py-2">{row.email}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.first_name || '-'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.last_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.valid.length > 10 && (
                  <div className="bg-muted/30 px-3 py-2 text-xs text-muted-foreground text-center">
                    ...and {preview.valid.length - 10} more
                  </div>
                )}
              </div>
            )}

            {/* Invalid rows */}
            {preview.invalid.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600">Invalid rows:</p>
                <div className="rounded-lg border border-red-200 dark:border-red-900 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50 dark:bg-red-950/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-300 uppercase">Row</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-300 uppercase">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-300 uppercase">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 dark:divide-red-900">
                      {preview.invalid.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-red-700 dark:text-red-300">{row.row}</td>
                          <td className="px-3 py-2 text-red-700 dark:text-red-300">{row.email || '(empty)'}</td>
                          <td className="px-3 py-2 text-red-700 dark:text-red-300">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={importing}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || preview.valid.length === 0}
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {preview.valid.length} subscriber{preview.valid.length === 1 ? '' : 's'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
              <div className="text-center">
                <p className="text-lg font-medium">
                  {result.imported} subscriber{result.imported === 1 ? '' : 's'} imported
                </p>
                {result.skipped > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {result.skipped} row{result.skipped === 1 ? '' : 's'} skipped (invalid)
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
