import { useTranslation } from 'react-i18next';
import { FriendsPanel } from './FriendsPanel';
import { NudgesPanel } from './NudgesPanel';

// The leaderboard comes with #69.
export default function SocialPage() {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t('area.social')}</h1>
      <NudgesPanel />
      <FriendsPanel />
    </>
  );
}
