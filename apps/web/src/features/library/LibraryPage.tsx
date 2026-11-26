import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatures } from '../../state/plugins';

// Stub: the library screens come with #56, #58 and #61.
export default function LibraryPage() {
  const { t } = useTranslation();
  const { characterStudy } = useFeatures();
  return (
    <>
      <h1>{t('area.library')}</h1>
      <h2>
        <Link to="/library/grammar">{t('library.grammar')}</Link>
      </h2>
      {/* FR-241: the Kanji area only for a course whose plugin has character study. */}
      {characterStudy && <h2>{t('library.kanji')}</h2>}
    </>
  );
}
