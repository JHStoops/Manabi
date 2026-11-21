import { useTranslation } from 'react-i18next';
import SessionsList from '../auth/SessionsList';
import SignOutButton from '../auth/SignOutButton';

// Stub: the profile and settings screen comes with #40; sign-out and sessions come from #22.
export default function ProfilePage() {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t('area.profile')}</h1>
      <SignOutButton />
      <SessionsList />
    </>
  );
}
