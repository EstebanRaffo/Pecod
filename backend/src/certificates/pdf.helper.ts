import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface CertificatePdfData {
  studentName: string;
  courseName: string;
  institutionName: string;
  professorName: string;
  issuedAt: Date | string;
  code: string;
}

function cleanWinAnsi(str: string): string {
  // Normalize string for standard PDF WinAnsi font support
  return str.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
}

export async function generateCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  // Landscape A4: 842 x 595 points
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Outer decorative border
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: rgb(0.12, 0.22, 0.42),
    borderWidth: 3,
  });

  // Inner border
  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: rgb(0.72, 0.78, 0.88),
    borderWidth: 1,
  });

  const studentName = cleanWinAnsi(data.studentName);
  const courseName = cleanWinAnsi(data.courseName);
  const institutionName = cleanWinAnsi(data.institutionName);
  const professorName = cleanWinAnsi(data.professorName);
  const code = cleanWinAnsi(data.code);

  // Institution header
  const instUpper = institutionName.toUpperCase();
  const instWidth = fontBold.widthOfTextAtSize(instUpper, 16);
  page.drawText(instUpper, {
    x: (width - instWidth) / 2,
    y: height - 85,
    size: 16,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.5),
  });

  // Title: "CERTIFICADO DE FINALIZACIÓN"
  const title = 'CERTIFICADO DE FINALIZACIÓN';
  const titleWidth = fontBold.widthOfTextAtSize(title, 26);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 135,
    size: 26,
    font: fontBold,
    color: rgb(0.08, 0.15, 0.3),
  });

  // "Se certifica que"
  const certText = 'Se certifica que';
  const certWidth = fontRegular.widthOfTextAtSize(certText, 14);
  page.drawText(certText, {
    x: (width - certWidth) / 2,
    y: height - 185,
    size: 14,
    font: fontRegular,
    color: rgb(0.35, 0.4, 0.45),
  });

  // Student name (centered, fitted)
  let studentSize = 24;
  let sWidth = fontBold.widthOfTextAtSize(studentName, studentSize);
  while (sWidth > width - 120 && studentSize > 12) {
    studentSize -= 1;
    sWidth = fontBold.widthOfTextAtSize(studentName, studentSize);
  }
  page.drawText(studentName, {
    x: (width - sWidth) / 2,
    y: height - 230,
    size: studentSize,
    font: fontBold,
    color: rgb(0.05, 0.1, 0.2),
  });

  // "ha completado y aprobado satisfactoriamente el curso"
  const compText = 'ha completado y aprobado satisfactoriamente el curso';
  const compWidth = fontRegular.widthOfTextAtSize(compText, 14);
  page.drawText(compText, {
    x: (width - compWidth) / 2,
    y: height - 275,
    size: 14,
    font: fontRegular,
    color: rgb(0.35, 0.4, 0.45),
  });

  // Course name (centered, fitted)
  let courseSize = 22;
  let cWidth = fontBold.widthOfTextAtSize(courseName, courseSize);
  while (cWidth > width - 120 && courseSize > 12) {
    courseSize -= 1;
    cWidth = fontBold.widthOfTextAtSize(courseName, courseSize);
  }
  page.drawText(courseName, {
    x: (width - cWidth) / 2,
    y: height - 320,
    size: courseSize,
    font: fontBold,
    color: rgb(0.12, 0.22, 0.42),
  });

  // Professor footer (left)
  page.drawText('Profesor:', {
    x: 80,
    y: 135,
    size: 12,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5),
  });
  page.drawText(professorName, {
    x: 80,
    y: 115,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Issue date footer (right)
  const dateObj = typeof data.issuedAt === 'string' ? new Date(data.issuedAt) : data.issuedAt;
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;

  page.drawText('Fecha de emisión:', {
    x: width - 260,
    y: 135,
    size: 12,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5),
  });
  page.drawText(formattedDate, {
    x: width - 260,
    y: 115,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Certificate code footer (bottom center)
  const codeText = `Código único de certificado: ${code}`;
  const codeWidth = fontRegular.widthOfTextAtSize(codeText, 10);
  page.drawText(codeText, {
    x: (width - codeWidth) / 2,
    y: 52,
    size: 10,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.55),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
