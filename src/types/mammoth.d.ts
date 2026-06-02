declare module 'mammoth' {
  export function convertToHtml(opts: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
}
