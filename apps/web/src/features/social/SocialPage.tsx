import { useTranslation } from 'react-i18next';

// Stub: the social screens come with #69 and #70.
export default function SocialPage() {
  const { t } = useTranslation();
  return <h1>{t('area.social')}</h1>;
}
