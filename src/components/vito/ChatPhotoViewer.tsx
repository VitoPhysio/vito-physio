import { useEffect, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Download, Forward, Share2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { downloadChatFile } from "@/lib/chat-media";

export function ChatPhotoViewer({ url, name, onClose, onForward }: { url: string; name: string; onClose: () => void; onForward: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Photo unavailable");
      const blob = await response.blob();
      setFile(new File([blob], name, { type: blob.type }));
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [url, name]);
  async function share() {
    if (!file) return;
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else downloadChatFile(file);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Unable to share this photo.");
    }
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="z-[180] flex h-[90dvh] w-[calc(100%_-_1rem)] max-w-5xl flex-col gap-3 overflow-hidden p-3" overlayClassName="z-[179]" aria-describedby={undefined}>
      <DialogTitle className="truncate pr-8 text-sm">{name}</DialogTitle>
      <TransformWrapper minScale={1} maxScale={6} centerOnInit>
        {({ zoomIn, zoomOut, resetTransform }) => <>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full !items-center !justify-center">
              <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
            </TransformComponent>
          </div>
          <div className="flex shrink-0 flex-wrap justify-center gap-1 border-t pt-2">
            <Button variant="ghost" size="icon" title="Zoom in" aria-label="Zoom in" onClick={() => zoomIn()}><ZoomIn /></Button>
            <Button variant="ghost" size="icon" title="Zoom out" aria-label="Zoom out" onClick={() => zoomOut()}><ZoomOut /></Button>
            <Button variant="ghost" size="icon" title="Reset zoom" aria-label="Reset zoom" onClick={() => resetTransform()}><RotateCcw /></Button>
            <Button variant="ghost" size="icon" title={failed ? "Photo download unavailable" : "Download photo"} aria-label="Download photo" disabled={!file} onClick={() => { if (file) downloadChatFile(file); }}><Download /></Button>
            <Button variant="ghost" size="icon" title="Forward photo" aria-label="Forward photo" onClick={onForward}><Forward /></Button>
            <Button variant="ghost" size="icon" title="Share photo" aria-label="Share photo" disabled={!file} onClick={() => void share()}><Share2 /></Button>
          </div>
        </>}
      </TransformWrapper>
    </DialogContent>
  </Dialog>;
}