import { useTranslation } from 'react-i18next';

// Stub: the library screens come with #56, #58 and #61.
export default function LibraryPage() {
  const { t } = useTranslation();
  return <h1>{t('area.library')}</h1>;
}
