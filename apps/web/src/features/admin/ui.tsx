import styled from '@emotion/styled';
import { tapTarget } from '../../theme';

// Small shared pieces of the admin console screens.

export const Section = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing(6)};
  overflow-x: auto;
`;

export const Form = styled.form`
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(3)};

  label {
    display: flex;
    flex-direction: column;
    font-size: ${({ theme }) => theme.fontSizes.small};
  }
  input,
  select {
    min-height: 44px;
  }
`;

export const Table = styled.table`
  border-collapse: collapse;
  width: 100%;
  /* Phones scroll the table sideways (Section) instead of crushing its columns. */
  min-width: 40rem;

  th,
  td {
    text-align: left;
    padding: ${({ theme }) => theme.spacing(2)};
    vertical-align: middle;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

export const Button = styled.button`
  ${({ theme }) => tapTarget(theme)};
  padding: 0 ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.radii.small};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
`;
