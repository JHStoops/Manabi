import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatures } from '../../state/plugins';
import { tapTarget } from '../../theme';

// FR-241, IF-03: the Library landing page. One large tappable entry per area, stacked on phones
// and in columns from 768 px. The vocabulary list (#77) adds its entry to `areas` later.

const Entries = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing(3)};
  grid-template-columns: 1fr;
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Entry = styled(Link)`
  ${({ theme }) => tapTarget(theme)};
  display: block;
  box-sizing: border-box;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.colors.text};
  text-decoration: none;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.medium};
  strong {
    display: block;
    font-size: ${({ theme }) => theme.fontSizes.body};
  }
  span {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.small};
  }
`;

export default function LibraryPage() {
  const { t } = useTranslation();
  const { characterStudy } = useFeatures();
  const areas = [
    { id: 'grammar' as const, to: '/library/grammar' },
    // FR-241: the Kanji area only for a course whose plugin has character study.
    ...(characterStudy ? [{ id: 'kanji' as const, to: '/library/kanji' }] : []),
  ];
  return (
    <>
      <h1>{t('area.library')}</h1>
      <Entries>
        {areas.map(({ id, to }) => (
          <li key={id}>
            <Entry to={to}>
              <strong>{id === 'kanji' ? t('library.kanji') : t('library.grammar')}</strong>
              <span>
                {id === 'kanji' ? t('library.landing.kanji') : t('library.landing.grammar')}
              </span>
            </Entry>
          </li>
        ))}
      </Entries>
    </>
  );
}
