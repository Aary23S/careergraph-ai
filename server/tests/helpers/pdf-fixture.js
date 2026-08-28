/**
 * Builds a minimal, structurally-valid single-page PDF buffer for tests that
 * exercise the resume upload -> AI enrichment pipeline. The actual AI
 * response is always mocked in those tests (jest.spyOn(aiService, ...)), so
 * the text content here is never asserted on -- it only needs to survive a
 * real PDF parse (server/src/services/resume-ai-enrichment.service.js uses
 * pdf-parse's PDFParse class, which rejects non-PDF byte content outright).
 */
export function buildMinimalPdfBuffer(text = 'Resume Content') {
  const escaped = text.replace(/([()\\])/g, '\\$1');
  const contentStream = `BT /F1 12 Tf 50 750 Td (${escaped}) Tj ET`;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf-8');
}
