/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Send, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { StoreNoticeDialog } from "@/features/entitlements/components/store-notice-dialog";
import {
  getAdminStoreNotice,
  publishStoreNotice,
  saveStoreNoticeDraft,
} from "@/features/entitlements/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { SettingsSection } from "../components/settings-section";

const MAX_CHARACTERS = 5000;

export function StoreNoticeSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const notice = useQuery({
    queryKey: ["admin", "store-notice"],
    queryFn: getAdminStoreNotice,
  });
  const data = notice.data?.data;

  useEffect(() => {
    if (data) setContent(data.draft_content ?? "");
  }, [data]);

  const characterCount = useMemo(() => Array.from(content).length, [content]);
  const changed = data ? content !== data.draft_content : false;
  const validForPublish =
    content.trim().length > 0 && characterCount <= MAX_CHARACTERS;

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "store-notice"],
    });
  };

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error(t("Store notice is not ready"));
      const response = await saveStoreNoticeDraft({
        content,
        expected_draft_version: data.draft_version,
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || t("Failed to save draft"));
      }
      return response.data;
    },
    onSuccess: async () => {
      toast.success(t("Draft saved"));
      await refresh();
    },
    onError: async (error) => {
      toast.error(error.message);
      await refresh();
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error(t("Store notice is not ready"));
      const response = await publishStoreNotice({
        expected_revision: data.current_revision,
        expected_draft_version: data.draft_version,
      });
      if (!response.success || !response.data) {
        throw new Error(
          response.message || t("Failed to publish store notice"),
        );
      }
      return response.data;
    },
    onSuccess: async (revision) => {
      setPublishOpen(false);
      toast.success(
        t("Store notice revision {{revision}} published", {
          revision: revision.revision,
        }),
      );
      await refresh();
    },
    onError: async (error) => {
      setPublishOpen(false);
      toast.error(error.message);
      await refresh();
    },
  });

  if (notice.isPending) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("Loading store notice...")}
      </p>
    );
  }
  if (notice.isError || !data) {
    return (
      <p className="text-destructive text-sm">
        {t("Failed to load store notice")}
      </p>
    );
  }

  return (
    <SettingsSection title={t("Store Notice")}>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{t("Store Notice")}</CardTitle>
              <CardDescription>
                {t(
                  "Shown before shoppers purchase subscriptions or recharge quota.",
                )}
              </CardDescription>
            </div>
            {data.current_revision > 0 ? (
              <Badge variant="secondary">
                {t("Published revision {{revision}}", {
                  revision: data.current_revision,
                })}
              </Badge>
            ) : (
              <Badge variant="outline">{t("Not published")}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <label htmlFor="store-notice-content" className="font-medium">
                {t("Markdown content")}
              </label>
              <span
                className={
                  characterCount > MAX_CHARACTERS
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {characterCount}/{MAX_CHARACTERS}
              </span>
            </div>
            <Textarea
              id="store-notice-content"
              rows={16}
              maxLength={MAX_CHARACTERS}
              value={content}
              placeholder={t(
                "Explain subscription, quota, access group, and support rules...",
              )}
              onChange={(event) => setContent(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {t(
                "Saving changes only updates the draft. Publishing creates a new revision and shows it again to shoppers who dismissed the previous revision.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!validForPublish}
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="mr-2 size-4" />
              {t("Preview")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !changed ||
                characterCount > MAX_CHARACTERS ||
                saveDraft.isPending
              }
              onClick={() => saveDraft.mutate()}
            >
              <Save className="mr-2 size-4" />
              {saveDraft.isPending ? t("Saving...") : t("Save draft")}
            </Button>
            <Button
              type="button"
              disabled={changed || !validForPublish || publish.isPending}
              onClick={() => setPublishOpen(true)}
            >
              <Send className="mr-2 size-4" />
              {t("Publish")}
            </Button>
          </div>
          {changed ? (
            <p className="text-muted-foreground text-right text-xs">
              {t("Save the draft before publishing.")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <StoreNoticeDialog
        preview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        content={content}
      />

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Publish store notice?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Every publication creates a new revision and shows the notice again to shoppers who dismissed the previous revision.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={publish.isPending}
              onClick={() => publish.mutate()}
            >
              {publish.isPending ? t("Publishing...") : t("Publish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
