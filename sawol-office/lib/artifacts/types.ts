export type ArtifactKind =
  | "TEXT"
  | "SPREADSHEET"
  | "DOCUMENT"
  | "PDF"
  | "IMAGE"
  | "PRESENTATION"
  | "CODE"
  | "DATA"
  | "ARCHIVE";

export type ArtifactFormat =
  | "txt"
  | "md"
  | "xlsx"
  | "csv"
  | "docx"
  | "hwp"
  | "pdf"
  | "png"
  | "jpg"
  | "svg"
  | "pptx"
  | "json"
  | "zip"
  | "code";

export type ArtifactGenerator =
  | "text"
  | "spreadsheet"
  | "document"
  | "pdf"
  | "image"
  | "presentation"
  | "code"
  | "data"
  | "archive";

export type ArtifactPlanItem = {
  id: string;
  kind: ArtifactKind;
  format: ArtifactFormat;
  label: string;
  generator: ArtifactGenerator;
  quantity: number;
  required: boolean;
  reason: string;
};

export type ArtifactPlan = {
  version: "25.0";
  sourceText: string;
  items: ArtifactPlanItem[];
  isMultiArtifact: boolean;
  primaryKind: ArtifactKind;
};

export type GeneratedArtifact = {
  id: string;
  kind: ArtifactKind;
  format: ArtifactFormat;
  label: string;
  mimeType: string;
  url?: string | null;
  storagePath?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  metadata?: Record<string, unknown> | null;
};
