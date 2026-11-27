import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import { tapTarget } from '../../theme';

/** IF-03: the Library pages' back link, a 44 px tap target. */
export const BackLink = styled(Link)`
  ${({ theme }) => tapTarget(theme)};
  display: inline-flex;
  align-items: center;
`;
