// ─── Base Components ─────────────────────────────────────────────────────────

// Button
export { Button, buttonVariants } from './button';
export type { ButtonProps } from './button';

// Card
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';

// Badge
export { Badge, badgeVariants } from './badge';
export type { BadgeProps } from './badge';

// Input
export { Input } from './input';
export type { InputProps } from './input';

// Textarea
export { Textarea } from './textarea';
export type { TextareaProps } from './textarea';

// Label
export { Label } from './label';

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export type { TabsListProps, TabsTriggerProps } from './tabs';

// Table
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';

// Dialog
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './dialog';

// Select
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './select';

// Checkbox
export { Checkbox } from './checkbox';

// Switch
export { Switch } from './switch';

// Radio Group
export { RadioGroup, RadioGroupItem } from './radio-group';

// Avatar
export { Avatar, AvatarImage, AvatarFallback, avatarVariants } from './avatar';
export type { AvatarProps, AvatarFallbackProps } from './avatar';

// Tooltip
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip';

// Popover
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from './popover';

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './dropdown-menu';

// Separator
export { Separator } from './separator';

// Skeleton
export { Skeleton } from './skeleton';

// Progress
export { Progress } from './progress';

// ScrollArea
export { ScrollArea, ScrollBar } from './scroll-area';

// Accordion
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion';

// Sheet
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './sheet';

// Toggle
export { Toggle, toggleVariants } from './toggle';

// Toggle Group
export { ToggleGroup, ToggleGroupItem } from './toggle-group';

// ─── Custom Primitives ───────────────────────────────────────────────────────

// NavItem
export { NavItem, navItemVariants } from './nav-item';
export type { NavItemProps } from './nav-item';

// SectionLabel
export { SectionLabel } from './section-label';
export type { SectionLabelProps } from './section-label';

// ListRow
export { ListRow } from './list-row';
export type { ListRowProps } from './list-row';

// PropertyGroup
export { PropertyGroup } from './property-group';
export type { PropertyGroupProps } from './property-group';

// EmptyState
export { EmptyState } from './empty-state';
export type { EmptyStateProps } from './empty-state';

// SettingRow
export { SettingRow } from './setting-row';
export type { SettingRowProps } from './setting-row';

// StatusDot
export { StatusDot, statusDotVariants } from './status-dot';
export type { StatusDotProps } from './status-dot';

// PageTitle
export { PageTitle } from './page-title';
export type { PageTitleProps } from './page-title';

// Kbd
export { Kbd } from './kbd';
export type { KbdProps } from './kbd';

// Spinner
export { Spinner, spinnerVariants } from './spinner';
export type { SpinnerProps } from './spinner';

// Truncate
export { Truncate } from './truncate';
export type { TruncateProps } from './truncate';

// RelativeTime
export { RelativeTime } from './relative-time';
export type { RelativeTimeProps } from './relative-time';

// DotSeparator
export { DotSeparator } from './dot-separator';
export type { DotSeparatorProps } from './dot-separator';

// IconWrapper
export { IconWrapper, iconWrapperVariants } from './icon-wrapper';
export type { IconWrapperProps } from './icon-wrapper';

// ─── Composite Components ────────────────────────────────────────────────────

// FormField
export { FormField } from './form-field';
export type { FormFieldProps } from './form-field';

// SearchInput
export { SearchInput } from './search-input';
export type { SearchInputProps } from './search-input';

// ConfirmDialog
export { ConfirmDialog } from './confirm-dialog';
export type { ConfirmDialogProps } from './confirm-dialog';

// StatCard
export { StatCard } from './stat-card';
export type { StatCardProps } from './stat-card';

// AvatarGroup
export { AvatarGroup } from './avatar-group';
export type { AvatarGroupProps } from './avatar-group';

// ActionMenu
export { ActionMenu } from './action-menu';
export type { ActionMenuProps, ActionMenuAction } from './action-menu';

// DateDisplay
export { DateDisplay } from './date-display';
export type { DateDisplayProps } from './date-display';

// LoadingRow
export { LoadingRow } from './loading-row';
export type { LoadingRowProps } from './loading-row';

// LoadingCard
export { LoadingCard } from './loading-card';
export type { LoadingCardProps } from './loading-card';

// InfoRow
export { InfoRow } from './info-row';
export type { InfoRowProps } from './info-row';

// TagInput
export { TagInput } from './tag-input';
export type { TagInputProps } from './tag-input';

// Combobox
export { Combobox } from './combobox';
export type { ComboboxProps, ComboboxOption } from './combobox';

// FilterBar
export { FilterBar } from './filter-bar';
export type { FilterBarProps } from './filter-bar';

// ─── Layout Components ───────────────────────────────────────────────────────

// TopBar
export { TopBar } from './top-bar';
export type { TopBarProps } from './top-bar';

// MasterDetail
export { MasterDetail, MasterPane, DetailPane } from './master-detail';
export type { MasterDetailProps, MasterPaneProps } from './master-detail';

// PageContainer
export { PageContainer } from './page-container';
export type { PageContainerProps } from './page-container';

// SectionContainer
export { SectionContainer } from './section-container';
export type { SectionContainerProps } from './section-container';

// SettingsLayout
export { SettingsLayout } from './settings-layout';
export type { SettingsLayoutProps } from './settings-layout';
