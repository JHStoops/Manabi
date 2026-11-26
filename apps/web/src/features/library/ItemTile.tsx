import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { RETIRED_STAGE, STAGE_BANDS } from '@manabi/core';
import type { Stage } from '@manabi/core';

const Tile = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.surface};
`;

const Text = styled.span`
  display: flex;
  flex-direction: column;
  small {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.small};
  }
`;

const R = 10;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The stage band's name: the ladder's names for stages 1 to 8, or "not started". */
const bandOf = (stage: Stage | null) =>
  stage === null
    ? 'not_started'
    : (Object.keys(STAGE_BANDS) as (keyof typeof STAGE_BANDS)[]).find((band) => {
        const range = STAGE_BANDS[band];
        return range !== null && stage >= range[0] && stage <= range[1];
      })!;

/**
 * FR-102, NFR-31: an item as a tile, with its stage as a ring filled stage/8 and as the stage
 * name in text, so the stage never relies on color alone. Reused by every library screen.
 */
export function ItemTile({
  label,
  stage,
  lang,
}: {
  label: string;
  stage: Stage | null;
  lang?: string;
}) {
  const { t } = useTranslation();
  const name = t(`stage.${bandOf(stage)}`);
  return (
    <Tile>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle
          cx="14"
          cy="14"
          r={R}
          fill="none"
          stroke="currentColor"
          opacity="0.25"
          strokeWidth="4"
        />
        {stage !== null && (
          <circle
            cx="14"
            cy="14"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={`${(CIRCUMFERENCE * stage) / RETIRED_STAGE} ${CIRCUMFERENCE}`}
            transform="rotate(-90 14 14)"
          />
        )}
      </svg>
      <Text>
        <span lang={lang}>{label}</span>
        <small>{name}</small>
      </Text>
    </Tile>
  );
}
