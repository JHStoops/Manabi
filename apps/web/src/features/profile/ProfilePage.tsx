import { useTranslation } from 'react-i18next';

// Stub: the profile and settings screen comes with #40.
export default function ProfilePage() {
  const { t } = useTranslation();
  return <h1>{t('area.profile')}</h1>;
}
