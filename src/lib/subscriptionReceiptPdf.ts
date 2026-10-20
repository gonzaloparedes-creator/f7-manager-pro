import {
  buildSubscriptionReceiptHtml,
  receiptPdfFileName,
  waitForImages,
  type ReceiptHtmlOptions,
  type SubscriptionReceipt,
} from "@/lib/subscriptionReceipt";

// A4 a 96 dpi: el recibo se arma con este ancho y se pasa al PDF a 210 mm.
const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Genera el recibo en PDF y lo descarga. Se dibuja el mismo documento de la
// vista previa en un marco oculto y se pasa a imagen, así el PDF sale idéntico
// a lo que se ve (y a lo que se imprime). Las librerías pesan: se cargan recién
// al tocar el botón.
export async function downloadSubscriptionReceiptPdf(
  receipt: SubscriptionReceipt,
  options: ReceiptHtmlOptions = {}
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;border:0;`;
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("No se pudo preparar el documento");
    doc.open();
    doc.write(buildSubscriptionReceiptHtml(receipt, options));
    doc.close();
    await waitForImages(doc);

    const canvas = await html2canvas(doc.body, {
      scale: 2,
      backgroundColor: "#ffffff",
      width: PAGE_WIDTH_PX,
      windowWidth: PAGE_WIDTH_PX,
      logging: false,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    pdf.setProperties({ title: `Recibo ${receipt.receipt_number}`, creator: receipt.issuer_name });
    const image = canvas.toDataURL("image/jpeg", 0.92);
    const imageHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width;
    // Un recibo con observaciones muy largas puede pasar de una hoja: se corta en páginas.
    const pages = Math.max(1, Math.ceil((imageHeightMm - 0.5) / A4_HEIGHT_MM));
    for (let page = 0; page < pages; page += 1) {
      if (page > 0) pdf.addPage();
      pdf.addImage(image, "JPEG", 0, -page * A4_HEIGHT_MM, A4_WIDTH_MM, imageHeightMm, undefined, "FAST");
    }
    pdf.save(receiptPdfFileName(receipt));
  } finally {
    iframe.remove();
  }
}
