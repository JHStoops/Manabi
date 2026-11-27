import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { RETIRED_STAGE, STAGE_BANDS } from '@manabi/core';
import type { Stage, StageBand } from '@manabi/core';

const Tile = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.surface};
  small {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.small};
  }
`;

const Text = styled.span`
  display: flex;
  flex-direction: column;
`;

// The grid variant: the character sits inside its ring, the stage name below.
const GridTile = styled(Tile)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(1)};
  box-sizing: border-box;
  width: 100%;
  height: 100%;
`;

const Ringed = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  span {
    position: absolute;
    font-size: 1.5rem;
    line-height: 1;
  }
`;

const R = 10;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The stage band's name: the ladder's names for stages 1 to 8, or "not started". */
export const bandOf = (stage: Stage | null): StageBand =>
  stage === null
    ? 'not_started'
    : (Object.keys(STAGE_BANDS) as StageBand[]).find((band) => {
        const range = STAGE_BANDS[band];
        return range !== null && stage >= range[0] && stage <= range[1];
      })!;

function Ring({ stage, band, size }: { stage: Stage | null; band: StageBand; size: number }) {
  const theme = useTheme();
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <circle
        cx="14"
        cy="14"
        r={R}
        fill="none"
        stroke="currentColor"
        opacity="0.25"
        strokeWidth="4"
      />
      {stage !== null && band !== 'not_started' && (
        <circle
          cx="14"
          cy="14"
          r={R}
          fill="none"
          stroke={theme.stageColors[band]}
          strokeWidth="4"
          strokeDasharray={`${(CIRCUMFERENCE * stage) / RETIRED_STAGE} ${CIRCUMFERENCE}`}
          transform="rotate(-90 14 14)"
        />
      )}
    </svg>
  );
}

/**
 * FR-102, NFR-31: an item as a tile, with its stage as a ring filled stage/8 in its band's color
 * and as the stage name in text, so the stage never relies on color alone. Reused by every
 * library screen; `grid` puts a single character inside its ring for the character grid.
 */
export function ItemTile({
  label,
  stage,
  lang,
  variant = 'row',
}: {
  label: string;
  stage: Stage | null;
  lang?: string;
  variant?: 'row' | 'grid';
}) {
  const { t } = useTranslation();
  const band = bandOf(stage);
  const name = t(`stage.${band}`);
  if (variant === 'grid') {
    return (
      <GridTile data-stage-band={band}>
        <Ringed>
          <Ring stage={stage} band={band} size={56} />
          <span lang={lang}>{label}</span>
        </Ringed>
        <small>{name}</small>
      </GridTile>
    );
  }
  return (
    <Tile data-stage-band={band}>
      <Ring stage={stage} band={band} size={28} />
      <Text>
        <span lang={lang}>{label}</span>
        <small>{name}</small>
      </Text>
    </Tile>
  );
}
