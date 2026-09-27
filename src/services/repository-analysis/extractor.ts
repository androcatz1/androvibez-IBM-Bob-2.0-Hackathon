/**
 * ZIP extractor — unpacks a ZIP archive into RawFile records.
 *
 * Uses the browser's native DecompressionStream (DEFLATE/DEFLATE-raw)
 * for individual entries via a minimal hand-rolled ZIP parser that
 * reads the central directory, then streams each entry.
 *
 * Design constraints:
 *   - Browser-only (no Node fs). Works inside a Web Worker or main thread.
 *   - No external dependencies — avoids adding fflate or JSZip to the bundle.
 *   - Skips binary files and files matching the ignore list.
 *   - Caps individual file content at MAX_FILE_BYTES to prevent OOM.
 */

import { shouldIgnorePath } from './classifier'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum bytes read from a single file's content (text files only). */
const MAX_FILE_BYTES = 256 * 1024 // 256 KiB

/** Maximum total bytes decoded across all files. */
const MAX_TOTAL_BYTES = 8 * 1024 * 1024 // 8 MiB

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawFile {
  /** Path as stored in the ZIP (forward-slash normalised). */
  path: string
  /** File name without directory prefix. */
  name: string
  /** Original compressed size in bytes. */
  sizeBytes: number
  /** Decoded UTF-8 text content, or undefined for binary / oversized files. */
  content?: string
}

// ---------------------------------------------------------------------------
// ZIP structure constants (PKWARE spec)
// ---------------------------------------------------------------------------

const LOCAL_FILE_HEADER_SIG = 0x04034b50
const CENTRAL_DIR_SIG       = 0x02014b50
const EOCD_SIG               = 0x06054b50

// Compression methods
const COMPRESSION_STORED   = 0
const COMPRESSION_DEFLATED = 8

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readUint16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}

function readUint32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

/** Normalise a ZIP entry path to forward slashes and strip leading slash/dot. */
function normalizePath(raw: string): string {
  return raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '')
}

/** Very rough heuristic: if > 10 % of bytes in a sample are non-printable, treat as binary. */
function isBinaryBuffer(buf: Uint8Array): boolean {
  const sample = buf.subarray(0, Math.min(512, buf.length))
  let nonPrintable = 0
  for (const b of sample) {
    if (b === 0 || (b < 0x08) || (b > 0x0d && b < 0x20 && b !== 0x1b)) {
      nonPrintable++
    }
  }
  return nonPrintable / sample.length > 0.1
}

/** Decompress DEFLATE-compressed bytes using the browser's DecompressionStream. */
async function inflate(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  const reader = ds.readable.getReader()

  writer.write(compressed as unknown as Uint8Array<ArrayBuffer>)
  writer.close()

  const chunks: Uint8Array[] = []
  let totalLength = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      totalLength += value.length
    }
  }

  const out = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

// ---------------------------------------------------------------------------
// Central-directory reader
// ---------------------------------------------------------------------------

interface CentralDirEntry {
  fileName: string
  compressedSize: number
  uncompressedSize: number
  compressionMethod: number
  localHeaderOffset: number
}

/**
 * Locate the End-of-Central-Directory record and parse all central-directory
 * entries from it. This gives us offsets without scanning the whole file.
 */
function parseCentralDirectory(view: DataView): CentralDirEntry[] {
  const size = view.byteLength

  // Scan backwards for EOCD signature (allow up to 64 KiB comment)
  let eocdOffset = -1
  const searchFrom = Math.max(0, size - 65536 - 22)
  for (let i = size - 22; i >= searchFrom; i--) {
    if (readUint32LE(view, i) === EOCD_SIG) {
      eocdOffset = i
      break
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Not a valid ZIP archive: EOCD signature not found.')
  }

  const centralDirCount  = readUint16LE(view, eocdOffset + 10)
  const centralDirOffset = readUint32LE(view, eocdOffset + 16)

  const entries: CentralDirEntry[] = []
  let cursor = centralDirOffset

  for (let i = 0; i < centralDirCount; i++) {
    if (readUint32LE(view, cursor) !== CENTRAL_DIR_SIG) break

    const compressionMethod  = readUint16LE(view, cursor + 10)
    const compressedSize     = readUint32LE(view, cursor + 20)
    const uncompressedSize   = readUint32LE(view, cursor + 24)
    const fileNameLength     = readUint16LE(view, cursor + 28)
    const extraFieldLength   = readUint16LE(view, cursor + 30)
    const fileCommentLength  = readUint16LE(view, cursor + 32)
    const localHeaderOffset  = readUint32LE(view, cursor + 42)

    const fileNameBytes = new Uint8Array(view.buffer, cursor + 46, fileNameLength)
    const fileName = new TextDecoder().decode(fileNameBytes)

    entries.push({ fileName, compressedSize, uncompressedSize, compressionMethod, localHeaderOffset })
    cursor += 46 + fileNameLength + extraFieldLength + fileCommentLength
  }

  return entries
}

// ---------------------------------------------------------------------------
// Local file extractor
// ---------------------------------------------------------------------------

async function extractEntry(
  buffer: ArrayBuffer,
  entry: CentralDirEntry,
): Promise<Uint8Array | null> {
  const view = new DataView(buffer)
  const lh = entry.localHeaderOffset

  if (readUint32LE(view, lh) !== LOCAL_FILE_HEADER_SIG) return null

  const fileNameLen  = readUint16LE(view, lh + 26)
  const extraLen     = readUint16LE(view, lh + 28)
  const dataOffset   = lh + 30 + fileNameLen + extraLen

  const compressed = new Uint8Array(buffer, dataOffset, entry.compressedSize)

  if (entry.compressionMethod === COMPRESSION_STORED) {
    return compressed.slice() // copy to detach from buffer view
  }

  if (entry.compressionMethod === COMPRESSION_DEFLATED) {
    return inflate(compressed)
  }

  // Unsupported compression method
  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract text files from a ZIP archive File object.
 *
 * @param file  A ZIP File (from <input type="file"> or drag-and-drop).
 * @returns     Array of RawFile records with optional decoded content.
 */
export async function extractZip(file: File): Promise<RawFile[]> {
  const buffer = await file.arrayBuffer()
  const view = new DataView(buffer)

  let entries: CentralDirEntry[]
  try {
    entries = parseCentralDirectory(view)
  } catch (e) {
    throw new Error(`Failed to read ZIP archive: ${e instanceof Error ? e.message : String(e)}`)
  }

  const results: RawFile[] = []
  let totalBytesDecoded = 0

  for (const entry of entries) {
    const normalPath = normalizePath(entry.fileName)

    // Skip directories
    if (normalPath.endsWith('/') || entry.uncompressedSize === 0) continue

    // Apply ignore rules early — avoids decompressing node_modules etc.
    if (shouldIgnorePath(normalPath)) continue

    const sizeBytes = entry.uncompressedSize
    const name = normalPath.split('/').pop() ?? normalPath

    const raw: RawFile = { path: normalPath, name, sizeBytes }

    // Decide whether to decode content
    const withinFileBudget  = sizeBytes <= MAX_FILE_BYTES
    const withinTotalBudget = totalBytesDecoded < MAX_TOTAL_BYTES

    if (withinFileBudget && withinTotalBudget) {
      try {
        const bytes = await extractEntry(buffer, entry)
        if (bytes && !isBinaryBuffer(bytes)) {
          raw.content = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
          totalBytesDecoded += bytes.length
        }
      } catch {
        // Decompression failed — store the file without content
      }
    }

    results.push(raw)
  }

  return results
}

/**
 * Strip the common root prefix that ZIPs often include (e.g. "my-repo-main/").
 * Returns the same array with paths trimmed in-place.
 */
export function stripCommonPrefix(files: RawFile[]): RawFile[] {
  if (files.length === 0) return files

  // Find the longest common path prefix (directory name only)
  const firstParts = files[0].path.split('/')
  let prefixDepth = firstParts.length - 1

  for (const file of files) {
    const parts = file.path.split('/')
    let depth = 0
    for (let i = 0; i < Math.min(prefixDepth, parts.length - 1); i++) {
      if (parts[i] === firstParts[i]) depth++
      else break
    }
    prefixDepth = depth
  }

  if (prefixDepth === 0) return files

  const prefix = firstParts.slice(0, prefixDepth).join('/') + '/'
  for (const file of files) {
    if (file.path.startsWith(prefix)) {
      file.path = file.path.slice(prefix.length)
    }
  }

  return files
}
