'use client';

import { useState, useRef } from 'react';
import { X, Upload, Loader2, FileText } from 'lucide-react';

interface CSVTemplateImporterProps {
  onClose: () => void;
  onImported: () => void;
}

interface ParsedTemplate {
  name: string;
  category: string;
  description: string;
  structure: string;
  tags: string[];
}

function parseCSV(csvText: string): ParsedTemplate[] {
  const lines = csvText.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const nameIdx = headers.indexOf('name');
  const categoryIdx = headers.indexOf('category');
  const descIdx = headers.indexOf('description');
  const structIdx = headers.indexOf('structure');
  const tagsIdx = headers.indexOf('tags');

  if (nameIdx === -1 || structIdx === -1) return [];

  return lines.slice(1).map((line) => {
    // Simple CSV parsing (handles quoted fields)
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    return {
      name: fields[nameIdx] || '',
      category: categoryIdx >= 0 ? fields[categoryIdx] || '' : '',
      description: descIdx >= 0 ? fields[descIdx] || '' : '',
      structure: fields[structIdx] || '',
      tags: tagsIdx >= 0 ? (fields[tagsIdx] || '').split(';').map((t) => t.trim()).filter(Boolean) : [],
    };
  }).filter((t) => t.name && t.structure);
}

export function CSVTemplateImporter({ onClose, onImported }: CSVTemplateImporterProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedTemplate[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const templates = parseCSV(text);
      if (templates.length === 0) {
        setError('No valid templates found. CSV must have "name" and "structure" columns.');
      } else {
        setParsed(templates);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
    else setError('Please drop a .csv file');
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const response = await fetch('/api/content-pipeline/templates/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: parsed }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Import failed');
      }

      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import Templates from CSV</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {parsed.length === 0 ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Drop a CSV file or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Required columns: name, structure</p>
            <p className="text-xs text-muted-foreground">Optional: category, description, tags (semicolon-separated)</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-green-500" />
              <span>{parsed.length} template(s) ready to import</span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Name</th>
                    <th className="px-3 py-1.5 text-left font-medium">Category</th>
                    <th className="px-3 py-1.5 text-left font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((t, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5">{t.name}</td>
                      <td className="px-3 py-1.5">{t.category || '-'}</td>
                      <td className="px-3 py-1.5">{t.tags.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setParsed([])}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import {parsed.length}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
