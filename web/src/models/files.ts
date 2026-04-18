import { signal, computed, createModel } from "@preact/signals";

export type KnowledgeFile = {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  status: "indexing" | "ready" | "error";
  created_at: number;
};

export type FilesLimits = {
  maxFiles: number;
  maxFileBytes: number;
};

type ListResponse = {
  files: KnowledgeFile[];
  limits: FilesLimits;
  plan: "free" | "pro";
};

export const FilesModel = createModel(() => {
  const files = signal<KnowledgeFile[]>([]);
  const loading = signal(false);
  const uploading = signal(false);
  const error = signal<string | null>(null);
  const panelOpen = signal(false);
  const limits = signal<FilesLimits>({ maxFiles: 0, maxFileBytes: 0 });
  const plan = signal<"free" | "pro">("free");

  const canUpload = computed(
    () => plan.value === "pro" && files.value.length < limits.value.maxFiles,
  );
  const isLocked = computed(() => plan.value !== "pro" || limits.value.maxFiles <= 0);

  const togglePanel = () => {
    panelOpen.value = !panelOpen.value;
  };

  const load = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/v1/files", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load files");
      const data = (await res.json()) as ListResponse;
      files.value = data.files;
      limits.value = data.limits;
      plan.value = data.plan;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load files";
    } finally {
      loading.value = false;
    }
  };

  const upload = async (file: File) => {
    if (uploading.value) return;
    error.value = null;
    uploading.value = true;

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/v1/files", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      if (res.status === 402) {
        const body = (await res.json()) as { error?: string };
        error.value = body.error ?? "Upgrade to Pro to add files.";
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        error.value = body?.error ?? `Upload failed (${res.status})`;
        return;
      }

      const body = (await res.json()) as { file: KnowledgeFile };
      files.value = [body.file, ...files.value];
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Upload failed";
    } finally {
      uploading.value = false;
    }
  };

  const remove = async (fileId: string) => {
    error.value = null;
    const previous = files.value;
    files.value = files.value.filter((f) => f.id !== fileId);
    try {
      const res = await fetch(`/api/v1/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
    } catch (err) {
      // Revert on failure
      files.value = previous;
      error.value = err instanceof Error ? err.message : "Delete failed";
    }
  };

  return {
    files,
    loading,
    uploading,
    error,
    panelOpen,
    limits,
    plan,
    canUpload,
    isLocked,
    togglePanel,
    load,
    upload,
    remove,
  };
});
