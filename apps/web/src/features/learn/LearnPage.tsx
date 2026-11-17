import { useTranslation } from 'react-i18next';

// Stub: the Learn tab path screen comes with #25.
export default function LearnPage() {
  const { t } = useTranslation();
  return <h1>{t('area.learn')}</h1>;
}
