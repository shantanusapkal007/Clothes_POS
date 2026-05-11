import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function generateReceiptPdf(element: HTMLElement, filename: string): Promise<File> {
  const canvas = await html2canvas(element, {
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");

  // Calculate PDF dimensions based on element ratio
  const pdfWidth = 80; // 80mm receipt width standard
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pdfWidth, pdfHeight],
  });

  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

  const blob = pdf.output("blob");
  return new File([blob], filename, { type: "application/pdf" });
}
