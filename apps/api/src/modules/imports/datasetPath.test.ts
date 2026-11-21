import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { datasetPath, defaultDatasetFile } from './service';

// Issue #23: admin-started import jobs may only read files inside DATASETS_DIR.
describe('datasetPath', () => {
  let base: string;
  let root: string;

  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), 'manabi-datasets-'));
    root = join(base, 'datasets');
    await mkdir(join(root, 'jmdict'), { recursive: true });
    await writeFile(join(root, 'jmdict', 'JMdict_e'), '');
    await writeFile(join(base, 'secret'), '');
    await symlink(join(base, 'secret'), join(root, 'escape'));
  });

  afterAll(() => rm(base, { recursive: true, force: true }));

  it('resolves files inside the directory, existing or not', async () => {
    await expect(datasetPath(root, 'jmdict/JMdict_e')).resolves.toBe(
      join(root, 'jmdict', 'JMdict_e'),
    );
    await expect(datasetPath(root, 'jmdict/missing')).resolves.toBe(join(root, 'jmdict/missing'));
  });

  it('refuses paths that leave the directory', async () => {
    await expect(datasetPath(root, '../secret')).rejects.toThrow(/outside/);
    await expect(datasetPath(root, join(base, 'secret'))).rejects.toThrow(/outside/);
    await expect(datasetPath(root, 'escape')).rejects.toThrow(/outside/);
  });

  it('defaults to where the download script puts each dataset', () => {
    expect(defaultDatasetFile('jmdict')).toBe('jmdict/JMdict_e');
    expect(defaultDatasetFile('kanjidic2')).toBe('kanjidic2/kanjidic2.xml');
    expect(defaultDatasetFile('tatoeba')).toBe('tatoeba');
  });
});
