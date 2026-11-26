import { useTranslation } from 'react-i18next';
import { ImportsPanel } from './ImportsPanel';
import { InvitesPanel } from './InvitesPanel';
import { UsersPanel } from './UsersPanel';
import { BlockedWordsPanel, SupplementaryWordsPanel } from './WordListsPanels';

// Product Spec section 11 (Admin console): users, invites and imports (#23) and the word lists (#118). Activity and system
// panels come with their own issues.
export default function AdminPage() {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t('area.admin')}</h1>
      <UsersPanel />
      <InvitesPanel />
      <ImportsPanel />
      <SupplementaryWordsPanel />
      <BlockedWordsPanel />
    </>
  );
}
