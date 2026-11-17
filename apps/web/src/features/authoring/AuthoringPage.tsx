import { useTranslation } from 'react-i18next';

// Stub: the authoring editors come with #41 to #43.
export default function AuthoringPage() {
  const { t } = useTranslation();
  return <h1>{t('area.authoring')}</h1>;
}
