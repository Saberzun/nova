/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useTranslation } from "react-i18next";

import { Dialog } from "@/components/dialog";
import { RichContent } from "@/components/rich-content";
import { Button } from "@/components/ui/button";

type StoreNoticeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onDismissRevision?: () => void;
  dismissing?: boolean;
  preview?: boolean;
};

export function StoreNoticeDialog({
  open,
  onOpenChange,
  content,
  onDismissRevision,
  dismissing = false,
  preview = false,
}: StoreNoticeDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("Store Notice")}
      description={
        preview ? t("Preview uses the shopper display style.") : undefined
      }
      showCloseButton
      contentClassName="sm:max-w-[800px]"
      contentHeight="auto"
      bodyClassName="pr-4"
      footer={
        preview ? (
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={dismissing}
              onClick={onDismissRevision}
            >
              {dismissing ? t("Saving...") : t("Don't show again")}
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t("I understand")}
            </Button>
          </>
        )
      }
    >
      <RichContent breaks content={content} />
    </Dialog>
  );
}
