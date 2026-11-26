import { useTranslation } from 'react-i18next';
import { FriendsPanel } from './FriendsPanel';
import Leaderboard from './Leaderboard';
import { NudgesPanel } from './NudgesPanel';

export default function SocialPage() {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t('area.social')}</h1>
      <NudgesPanel />
      <Leaderboard />
      <FriendsPanel />
    </>
  );
}
