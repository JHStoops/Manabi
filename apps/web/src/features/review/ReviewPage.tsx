import { useTranslation } from 'react-i18next';

// Stub: the Review tab comes with #49.
export default function ReviewPage() {
  const { t } = useTranslation();
  return <h1>{t('area.review')}</h1>;
}
