'use client';
import type { Creative } from '@/lib/types/exploits';
interface GenerateDrawerProps {
  creative: Creative | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
}
export function GenerateDrawer({ open: _open, onOpenChange: _onOpenChange }: GenerateDrawerProps) {
  return null;
}
