'use client';

/**
 * PasteCreativeModal. Simple dialog for manually inputting creative content.
 * Submits to creatives API, shows score in toast result.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@magnetlab/magnetui';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateCreative } from '@/frontend/hooks/api/useCreatives';
import type { SourcePlatform } from '@/lib/types/exploits';

interface PasteCreativeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasteCreativeModal({ open, onOpenChange }: PasteCreativeModalProps) {
  const [contentText, setContentText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourcePlatform, setSourcePlatform] = useState<SourcePlatform>('manual');
  const [sourceAuthor, setSourceAuthor] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const { mutate: create, isPending } = useCreateCreative((creative) => {
    toast.success(`Creative added — score: ${creative.commentary_worthy_score}/10`);
    resetAndClose();
  });

  const resetAndClose = () => {
    setContentText('');
    setSourceUrl('');
    setSourcePlatform('manual');
    setSourceAuthor('');
    setImageUrl('');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!contentText.trim()) {
      toast.error('Content text is required');
      return;
    }
    try {
      await create({
        content_text: contentText,
        source_platform: sourcePlatform,
        source_url: sourceUrl || undefined,
        source_author: sourceAuthor || undefined,
        image_url: imageUrl || undefined,
      });
    } catch {
      toast.error('Failed to create creative');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Paste Creative</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Content Text *</Label>
            <Textarea
              className="mt-1.5"
              rows={4}
              placeholder="Paste the tweet, Reddit post, or any content..."
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground mt-1">{contentText.length}/5000</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Platform</Label>
              <Select
                value={sourcePlatform}
                onValueChange={(v) => setSourcePlatform(v as SourcePlatform)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source Author</Label>
              <Input
                className="mt-1.5"
                placeholder="@username or name"
                value={sourceAuthor}
                onChange={(e) => setSourceAuthor(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Source URL</Label>
            <Input
              className="mt-1.5"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>

          <div>
            <Label>Image URL</Label>
            <Input
              className="mt-1.5"
              placeholder="https://... (optional)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !contentText.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            {isPending ? 'Analyzing...' : 'Add Creative'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
