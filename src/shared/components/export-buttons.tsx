import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButtons({ onExcel, onPdf }: { onExcel: () => void; onPdf?: () => void }) {
  return (
    <div className="no-print flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onExcel}>
        <Download className="size-4" /> Excel
      </Button>
      {onPdf && (
        <Button type="button" variant="outline" size="sm" onClick={onPdf}>
          <Printer className="size-4" /> PDF
        </Button>
      )}
    </div>
  );
}
