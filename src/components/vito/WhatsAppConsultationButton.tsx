import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "256774234739";
const DEFAULT_MESSAGE = "Hello VITO Physio, I would like to make a consultation or inquiry.";

export function WhatsAppConsultationButton({ compact = false }: { compact?: boolean }) {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Contact VITO Physio on WhatsApp"
      className={
        compact
          ? "inline-flex items-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2 text-sm font-semibold text-[#128C7E] transition hover:bg-[#25D366]/20"
          : "inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#25D366]/20 transition hover:-translate-y-0.5 hover:bg-[#20bd5a]"
      }
    >
      <MessageCircle className="size-5" aria-hidden="true" />
      {compact ? "WhatsApp us" : "Consult on WhatsApp"}
    </a>
  );
}
