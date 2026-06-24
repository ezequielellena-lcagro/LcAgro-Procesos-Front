import logoFull from "@/assets/brand/logo-full.png";
import logoMark from "@/assets/brand/logo-mark.png";

// Logo de marca tomado del mockup (apps/mockup-web del repo backend):
// expandido → lockup completo "LC · La Clementina"; colapsado → solo la marca "LC".
export function BrandLogo({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return <img src={logoMark} alt="La Clementina" className="size-9 flex-none rounded-[9px]" />;
  }

  return <img src={logoFull} alt="La Clementina" className="h-7 w-auto flex-none" />;
}
