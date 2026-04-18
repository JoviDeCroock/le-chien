import { signal, createModel } from "@preact/signals";

export const ChatUIModel = createModel(() => {
  const sidebarOpen = signal(false);
  const shortcutsOpen = signal(false);
  const petPopoverOpen = signal(false);

  const toggleSidebar = (next?: boolean) => {
    sidebarOpen.value = next ?? !sidebarOpen.value;
  };

  const closeSidebar = () => {
    sidebarOpen.value = false;
  };

  const openShortcuts = () => {
    shortcutsOpen.value = true;
  };

  const closeShortcuts = () => {
    shortcutsOpen.value = false;
  };

  const togglePetPopover = () => {
    petPopoverOpen.value = !petPopoverOpen.value;
  };

  const closePetPopover = () => {
    petPopoverOpen.value = false;
  };

  return {
    sidebarOpen,
    shortcutsOpen,
    petPopoverOpen,
    toggleSidebar,
    closeSidebar,
    openShortcuts,
    closeShortcuts,
    togglePetPopover,
    closePetPopover,
  };
});
