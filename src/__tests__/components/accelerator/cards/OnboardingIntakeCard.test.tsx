/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingIntakeCard } from '@/components/accelerator/cards/OnboardingIntakeCard';

// ─── Fixtures ────────────────────────────────────────────

const singleSelectData = {
  question: 'What is your primary goal?',
  options: [
    { value: 'leads', label: 'Generate more leads' },
    { value: 'brand', label: 'Build my personal brand' },
    { value: 'revenue', label: 'Increase revenue' },
  ],
  multi_select: false,
  field_name: 'primary_goal',
};

const multiSelectData = {
  question: 'Which channels do you use?',
  options: [
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'email', label: 'Cold Email' },
    { value: 'twitter', label: 'Twitter' },
  ],
  multi_select: true,
  field_name: 'channels',
};

// ─── Tests ───────────────────────────────────────────────

describe('OnboardingIntakeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Missing Data ────────────────────────────────────

  it('returns null when data is undefined', () => {
    const { container } = render(<OnboardingIntakeCard data={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when question is missing', () => {
    const { container } = render(
      <OnboardingIntakeCard data={{ options: [{ value: 'a', label: 'A' }] }} />
    );
    expect(container.firstChild).toBeNull();
  });

  // ─── Rendering ───────────────────────────────────────

  it('renders question text', () => {
    render(<OnboardingIntakeCard data={singleSelectData} />);
    expect(screen.getByText('What is your primary goal?')).toBeInTheDocument();
  });

  it('renders all option labels as buttons', () => {
    render(<OnboardingIntakeCard data={singleSelectData} />);
    expect(screen.getByText('Generate more leads')).toBeInTheDocument();
    expect(screen.getByText('Build my personal brand')).toBeInTheDocument();
    expect(screen.getByText('Increase revenue')).toBeInTheDocument();
  });

  // ─── Single-Select ──────────────────────────────────

  it('single-select: clicking an option selects it (border-violet-500 class)', () => {
    render(<OnboardingIntakeCard data={singleSelectData} />);
    const option = screen.getByText('Generate more leads').closest('button')!;
    fireEvent.click(option);
    expect(option.className).toContain('border-violet-500');
  });

  it('single-select: clicking another option deselects previous', () => {
    render(<OnboardingIntakeCard data={singleSelectData} />);
    const first = screen.getByText('Generate more leads').closest('button')!;
    const second = screen.getByText('Build my personal brand').closest('button')!;

    fireEvent.click(first);
    expect(first.className).toContain('border-violet-500');

    fireEvent.click(second);
    expect(second.className).toContain('border-violet-500');
    expect(first.className).not.toContain('border-violet-500');
  });

  // ─── Multi-Select ───────────────────────────────────

  it('multi-select: clicking multiple options selects all of them', () => {
    render(<OnboardingIntakeCard data={multiSelectData} />);
    const linkedin = screen.getByText('LinkedIn').closest('button')!;
    const email = screen.getByText('Cold Email').closest('button')!;

    fireEvent.click(linkedin);
    fireEvent.click(email);

    expect(linkedin.className).toContain('border-violet-500');
    expect(email.className).toContain('border-violet-500');
  });

  it('multi-select: clicking selected option deselects it', () => {
    render(<OnboardingIntakeCard data={multiSelectData} />);
    const linkedin = screen.getByText('LinkedIn').closest('button')!;

    fireEvent.click(linkedin);
    expect(linkedin.className).toContain('border-violet-500');

    fireEvent.click(linkedin);
    expect(linkedin.className).not.toContain('border-violet-500');
  });

  // ─── Continue Button ────────────────────────────────

  it('continue button disabled when nothing selected', () => {
    render(<OnboardingIntakeCard data={singleSelectData} />);
    const continueBtn = screen.getByRole('button', { name: 'Continue' });
    expect(continueBtn).toBeDisabled();
  });

  it('calls onApply("intake_answer", { field_name, value }) on Continue click (single-select)', () => {
    const onApply = jest.fn();
    render(<OnboardingIntakeCard data={singleSelectData} onApply={onApply} />);

    fireEvent.click(screen.getByText('Generate more leads').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onApply).toHaveBeenCalledWith('intake_answer', {
      field_name: 'primary_goal',
      value: 'leads',
    });
  });

  it('calls onApply("intake_answer", { field_name, value }) on Continue click (multi-select)', () => {
    const onApply = jest.fn();
    render(<OnboardingIntakeCard data={multiSelectData} onApply={onApply} />);

    fireEvent.click(screen.getByText('LinkedIn').closest('button')!);
    fireEvent.click(screen.getByText('Cold Email').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onApply).toHaveBeenCalledWith('intake_answer', {
      field_name: 'channels',
      value: ['linkedin', 'email'],
    });
  });
});
