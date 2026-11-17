import { useTranslation } from 'react-i18next';
import './index';

describe('i18n', () => {
  it('rejects a misspelled key at typecheck', () => {
    function Probe() {
      const { t } = useTranslation();
      // @ts-expect-error unknown key
      return <p>{t('area.lern')}</p>;
    }
    expect(Probe).toBeDefined();
  });
});
