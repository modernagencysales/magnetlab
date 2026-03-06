import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from '../components/menubar';

const meta: Meta = {
  title: 'Base/Menubar',
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const [showStatusBar, setShowStatusBar] = React.useState(true);
    return (
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New Tab <MenubarShortcut>Cmd+T</MenubarShortcut></MenubarItem>
            <MenubarItem>New Window <MenubarShortcut>Cmd+N</MenubarShortcut></MenubarItem>
            <MenubarSeparator />
            <MenubarSub>
              <MenubarSubTrigger>Share</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem>Email</MenubarItem>
                <MenubarItem>Messages</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSeparator />
            <MenubarItem>Print <MenubarShortcut>Cmd+P</MenubarShortcut></MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Undo <MenubarShortcut>Cmd+Z</MenubarShortcut></MenubarItem>
            <MenubarItem>Redo <MenubarShortcut>Cmd+Shift+Z</MenubarShortcut></MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Cut <MenubarShortcut>Cmd+X</MenubarShortcut></MenubarItem>
            <MenubarItem>Copy <MenubarShortcut>Cmd+C</MenubarShortcut></MenubarItem>
            <MenubarItem>Paste <MenubarShortcut>Cmd+V</MenubarShortcut></MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem checked={showStatusBar} onCheckedChange={setShowStatusBar}>
              Status Bar
            </MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarItem>Zoom In <MenubarShortcut>Cmd++</MenubarShortcut></MenubarItem>
            <MenubarItem>Zoom Out <MenubarShortcut>Cmd+-</MenubarShortcut></MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
  },
};
