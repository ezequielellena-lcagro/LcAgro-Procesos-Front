import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButtons({
  onExcel,
  onPdf,
  excelLoading = false,
  excelDisabled = false,
  pdfDisabled = false,
}: {
  onExcel: () => void;
  onPdf?: () => void;
  excelLoading?: boolean;
  excelDisabled?: boolean;
  pdfDisabled?: boolean;
}) {
  return (
    <div className="no-print flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onExcel}
        disabled={excelLoading || excelDisabled}
      >
        <Download className="size-4" /> {excelLoading ? "Generando…" : "Excel"}
      </Button>
      {onPdf && (
        <Button type="button" variant="outline" size="sm" onClick={onPdf} disabled={pdfDisabled}>
          <Printer className="size-4" /> PDF
        </Button>
      )}
    </div>
  );
}
