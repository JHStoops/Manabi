import { useTranslation } from 'react-i18next';

// Stub: the admin console comes with #23.
export default function AdminPage() {
  const { t } = useTranslation();
  return <h1>{t('area.admin')}</h1>;
}
