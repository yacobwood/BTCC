import React from 'react';
import {render} from '@testing-library/react-native';
import CareerTimeline from '../../src/components/CareerTimeline';

describe('CareerTimeline', () => {
  it('renders nothing with fewer than 2 classified seasons', () => {
    const {toJSON} = render(<CareerTimeline history={[{year: 2024, pos: 3}]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when there are no classified (pos > 0) seasons at all', () => {
    const {toJSON} = render(<CareerTimeline history={[{year: 2023, pos: 0}, {year: 2024, pos: 0}]} />);
    expect(toJSON()).toBeNull();
  });

  it('ignores unclassified seasons when counting toward the 2-season minimum', () => {
    const {toJSON} = render(
      <CareerTimeline history={[{year: 2023, pos: 0}, {year: 2024, pos: 5}]} />,
    );
    expect(toJSON()).toBeNull(); // only 1 classified season after filtering pos:0
  });

  it('renders year labels (abbreviated to 2 digits) for classified seasons', () => {
    const {getByText} = render(
      <CareerTimeline history={[{year: 2016, pos: 3, points: 538}, {year: 2018, pos: 11, points: 198}]} />,
    );
    expect(getByText("'16")).toBeTruthy();
    expect(getByText("'18")).toBeTruthy();
  });

  it('renders P-prefixed y-axis position ticks', () => {
    const {getByText} = render(
      <CareerTimeline history={[{year: 2016, pos: 3}, {year: 2018, pos: 11}]} />,
    );
    expect(getByText('P1')).toBeTruthy();
  });

  it('does not require isChampion - team history (no wins/podiums/isChampion field) still renders', () => {
    // Real team.history shape is just {year, pos, points} - confirms the
    // component works with that reduced shape, not just driver.history's
    // richer one.
    const {getByText} = render(
      <CareerTimeline history={[{year: 2015, pos: 7, points: 223}, {year: 2016, pos: 3, points: 538}]} />,
    );
    expect(getByText("'15")).toBeTruthy();
    expect(getByText("'16")).toBeTruthy();
  });

  it('shows a star marker for a champion season when isChampion is present', () => {
    const {getByText} = render(
      <CareerTimeline history={[{year: 2016, pos: 1, isChampion: true}, {year: 2017, pos: 3}]} />,
    );
    expect(getByText('★')).toBeTruthy();
  });

  it('shows no star marker when no season is flagged a champion', () => {
    const {queryByText} = render(
      <CareerTimeline history={[{year: 2016, pos: 2}, {year: 2017, pos: 3}]} />,
    );
    expect(queryByText('★')).toBeNull();
  });
});
