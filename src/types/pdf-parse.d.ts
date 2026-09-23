declare module 'pdf-parse' {
  interface PDFData { text: string; numpages: number }
  function pdfParse(buffer: Buffer): Promise<PDFData>
  export default pdfParse
}
