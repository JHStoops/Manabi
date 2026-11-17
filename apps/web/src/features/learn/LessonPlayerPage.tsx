import { useTranslation } from 'react-i18next';

// Stub: the full-screen lesson player comes with #31.
export default function LessonPlayerPage() {
  const { t } = useTranslation();
  return <h1>{t('area.lesson')}</h1>;
}
