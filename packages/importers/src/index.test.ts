// PLACEHOLDER smoke test: replace with real importer tests once importers exist.
describe('@manabi/importers', () => {
  it('loads as a module', async () => {
    await expect(import('./index')).resolves.toBeDefined();
  });
});
