/**
 * Internet Archive (archive.org) API Client for exploring vintage MS-DOS & Shareware games.
 * Direct search and metadata queries support open CORS in browser environments.
 */

export interface ArchiveSearchItem {
  readonly identifier: string;
  readonly title: string;
  readonly description?: string;
  readonly year?: string;
  readonly mediatype?: string;
}

export interface ArchiveFileEntry {
  readonly name: string;
  readonly size?: string;
  readonly format?: string;
  readonly md5?: string;
}

export interface ArchiveMetadata {
  readonly server?: string;
  readonly dir?: string;
  readonly metadata?: {
    readonly title?: string;
    readonly description?: string;
    readonly creator?: string;
    readonly date?: string;
  };
  readonly files?: readonly ArchiveFileEntry[];
}

/**
 * Searches the Internet Archive software library for shareware or retro DOS titles.
 */
export async function searchArchive(
  query: string,
  rows = 10,
  fetchFn: typeof fetch = fetch
): Promise<readonly ArchiveSearchItem[]> {
  const encodedQuery = encodeURIComponent(`collection:softwarelibrary_msdos_games ${query}`);
  const url = `https://archive.org/advancedsearch.php?q=${encodedQuery}&fl[]=identifier,title,description,year,mediatype&output=json&rows=${rows}`;

  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`Archive search failed with HTTP status ${res.status}`);
  }

  const json = await res.json();
  const docs = json?.response?.docs;
  if (!Array.isArray(docs)) {
    return [];
  }

  return docs.map((d: Record<string, unknown>) => ({
    identifier: String(d.identifier ?? ''),
    title: String(d.title ?? ''),
    description: d.description ? String(d.description) : undefined,
    year: d.year ? String(d.year) : undefined,
    mediatype: d.mediatype ? String(d.mediatype) : undefined,
  }));
}

/**
 * Fetches the metadata and file listing for an Internet Archive item.
 */
export async function getArchiveMetadata(
  identifier: string,
  fetchFn: typeof fetch = fetch
): Promise<ArchiveMetadata> {
  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch metadata for ${identifier}: status ${res.status}`);
  }

  const data = await res.json();
  return {
    server: data.server,
    dir: data.dir,
    metadata: data.metadata,
    files: Array.isArray(data.files) ? data.files : [],
  };
}

/**
 * Resolves direct download URL for an item's file on Internet Archive.
 */
export function getArchiveFileUrl(identifier: string, filename: string): string {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(filename)}`;
}
