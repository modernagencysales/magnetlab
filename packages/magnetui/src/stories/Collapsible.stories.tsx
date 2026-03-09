import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/collapsible';
import { Button } from '../components/button';
import { ChevronsUpDown } from 'lucide-react';

const meta: Meta<typeof Collapsible> = {
  title: 'Base/Collapsible',
  component: Collapsible,
};
export default meta;
type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="w-[350px] space-y-2">
        <div className="flex items-center justify-between rounded-md border px-4 py-2">
          <span className="text-sm font-semibold">3 items tagged</span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <div className="rounded-md border px-4 py-2 text-sm">Always visible item</div>
        <CollapsibleContent className="space-y-2">
          <div className="rounded-md border px-4 py-2 text-sm">Hidden item 1</div>
          <div className="rounded-md border px-4 py-2 text-sm">Hidden item 2</div>
        </CollapsibleContent>
      </Collapsible>
    );
  },
};
