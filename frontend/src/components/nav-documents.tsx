"use client";

import * as React from "react";
import {
  IconDots,
  IconFolder,
  IconTrash,
  type Icon,
} from "@tabler/icons-react";
import * as Dialog from "@radix-ui/react-dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { deleteTranscript } from "@/lib/history";
import { cn } from "@/lib/utils";

export function NavDocuments({
  items,
}: {
  items: {
    id?: string;
    name: string;
    url: string;
    icon: Icon;
  }[];
}) {
  const { isMobile } = useSidebar();
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const getIdFromItem = (item: { id?: string; url: string }) => {
    if (item.id) return item.id;
    const m = item.url.match(/#t-(.+)/);
    return m ? m[1] : "";
  };

  const handleDeleteClick = (item: { id?: string; name: string; url: string }) => {
    const id = getIdFromItem(item);
    if (id) {
      setDeleteTarget({ id, name: item.name });
      setDeleteError(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteTranscript(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to delete transcript";
      setDeleteError(msg);
      console.error("Failed to delete transcript:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Transcripts</SidebarGroupLabel>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild>
                <a href={item.url}>
                  <item.icon />
                  <span>{item.name}</span>
                </a>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction
                    showOnHover
                    className="data-[state=open]:bg-accent rounded-sm"
                  >
                    <IconDots />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-24 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem
                    onClick={() => {
                      window.location.hash = item.url;
                    }}
                  >
                    <IconFolder />
                    <span>Open</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => handleDeleteClick(item)}
                  >
                    <IconTrash />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteTarget !== null} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/20 animate-in fade-in" />
          <Dialog.Content
            className={cn(
              "bg-background text-foreground fixed left-1/2 top-1/2 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2",
              "rounded-lg border p-4 shadow-lg focus:outline-hidden animate-in fade-in zoom-in-95"
            )}
          >
            <Dialog.Title className="text-base font-semibold">
              Delete Transcript
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </Dialog.Description>

            {deleteError && (
              <div className="mt-3 p-2 rounded bg-destructive/10 text-destructive text-sm">
                {deleteError}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" size="sm" disabled={isDeleting}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
