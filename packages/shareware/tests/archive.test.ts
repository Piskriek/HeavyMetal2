import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchArchive, getArchiveMetadata, getArchiveFileUrl } from '../src/archive-client';

describe('@hm/shareware - Internet Archive Client', () => {
  it('constructs search URL and parses response', async () => {
    let capturedUrl = '';
    const mockFetch = async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return {
        ok: true,
        json: async () => ({
          response: {
            docs: [
              { identifier: 'doom_dos', title: 'DOOM (MS-DOS)', year: '1993' },
              { identifier: 'quake_shareware', title: 'Quake Shareware', year: '1996' },
            ],
          },
        }),
      } as unknown as Response;
    };

    const results = await searchArchive('doom', 2, mockFetch as unknown as typeof fetch);
    assert.ok(capturedUrl.includes('collection%3Asoftwarelibrary_msdos_games'));
    assert.ok(capturedUrl.includes('output=json'));
    assert.equal(results.length, 2);
    assert.equal(results[0]?.identifier, 'doom_dos');
    assert.equal(results[0]?.title, 'DOOM (MS-DOS)');
  });

  it('fetches metadata for an item', async () => {
    const mockFetch = async () => {
      return {
        ok: true,
        json: async () => ({
          server: 'ia8001.us.archive.org',
          dir: '/items/doom_dos',
          metadata: { title: 'DOOM', creator: 'id Software' },
          files: [{ name: 'doom.zip', size: '13529921', format: 'ZIP' }],
        }),
      } as unknown as Response;
    };

    const meta = await getArchiveMetadata('doom_dos', mockFetch as unknown as typeof fetch);
    assert.equal(meta.server, 'ia8001.us.archive.org');
    assert.equal(meta.metadata?.creator, 'id Software');
    assert.equal(meta.files?.length, 1);
  });

  it('generates correct download URL', () => {
    const url = getArchiveFileUrl('doom_dos', 'doom.zip');
    assert.equal(url, 'https://archive.org/download/doom_dos/doom.zip');
  });
});
