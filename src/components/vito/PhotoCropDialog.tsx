import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

type PhotoCropDialogProps = {
  open: boolean;
  file: File | null;
  aspectRatio: number;
  title: string;
  onCancel: () => void;
  onSave: (file: File) => void;
};

type Offset = { x: number; y: number };

export function PhotoCropDialog({
  open,
  file,
  aspectRatio,
  title,
  onCancel,
  onSave,
}: PhotoCropDialogProps) {
  const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; offset: Offset } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError("");
    setImageSize({ width: 0, height: 0 });
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () =>
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [file, open]);

  const baseScale =
    viewportSize.width && imageSize.width
      ? Math.max(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height)
      : 0;
  const displayWidth = imageSize.width * baseScale * zoom;
  const displayHeight = imageSize.height * baseScale * zoom;
  const maxOffsetX = Math.max(0, (displayWidth - viewportSize.width) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - viewportSize.height) / 2);
  const boundedOffset = {
    x: Math.min(maxOffsetX, Math.max(-maxOffsetX, offset.x)),
    y: Math.min(maxOffsetY, Math.max(-maxOffsetY, offset.y)),
  };

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset: boundedOffset,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({
      x: Math.min(maxOffsetX, Math.max(-maxOffsetX, drag.offset.x + event.clientX - drag.x)),
      y: Math.min(maxOffsetY, Math.max(-maxOffsetY, drag.offset.y + event.clientY - drag.y)),
    });
  }

  async function saveCrop() {
    const image = imageRef.current;
    if (!image || !viewportSize.width || !viewportSize.height || !baseScale || saving) return;
    setSaving(true);
    setError("");
    try {
      const scale = baseScale * zoom;
      const left = (viewportSize.width - displayWidth) / 2 + boundedOffset.x;
      const top = (viewportSize.height - displayHeight) / 2 + boundedOffset.y;
      const sourceWidth = viewportSize.width / scale;
      const sourceHeight = viewportSize.height / scale;
      const sourceX = Math.min(image.naturalWidth - sourceWidth, Math.max(0, -left / scale));
      const sourceY = Math.min(image.naturalHeight - sourceHeight, Math.max(0, -top / scale));
      const outputWidth = aspectRatio > 1 ? 1800 : 900;
      const outputHeight = Math.round(outputWidth / aspectRatio);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This photo could not be cropped on this device.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, outputWidth, outputHeight);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error("This photo could not be saved.")),
          "image/jpeg",
          0.92,
        );
      });
      const baseName = file?.name.replace(/\.[^.]+$/, "") || "profile-photo";
      onSave(
        new File([blob], `${baseName}-cropped.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        }),
      );
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "This photo could not be cropped.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onCancel();
      }}
    >
      <DialogContent className="max-h-[92dvh] w-[min(96vw,48rem)] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crop {title.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Drag the photo to choose what appears, then zoom in if needed. Only the framed area will
            be saved.
          </DialogDescription>
        </DialogHeader>
        <div
          ref={viewportRef}
          className="relative mx-auto w-full max-w-3xl touch-none select-none overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: String(aspectRatio) }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          {imageUrl && (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Photo crop preview"
              draggable={false}
              onLoad={(event) =>
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              className="pointer-events-none absolute max-w-none"
              style={{
                width: displayWidth,
                height: displayHeight,
                left: (viewportSize.width - displayWidth) / 2 + boundedOffset.x,
                top: (viewportSize.height - displayHeight) / 2 + boundedOffset.y,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/80" />
        </div>
        <label className="block space-y-2 text-sm font-medium">
          <span>Zoom</span>
          <Slider
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            onValueChange={([value]) => setZoom(value ?? 1)}
            aria-label="Zoom photo"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || !imageSize.width}
            onClick={() => void saveCrop()}
          >
            {saving ? "Preparing…" : "Use this crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
