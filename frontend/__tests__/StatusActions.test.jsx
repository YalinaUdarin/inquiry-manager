// The status panel on the detail page: which buttons appear, and what the
// user is told after a change succeeds, conflicts with someone else's
// change (stale data), or is refused.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusActions } from '@/components/inquiries/StatusActions';
import { ApiError } from '@/lib/api';

// Minimal inquiry objects, shaped like the API's responses.
const NEW_V1 = { status: 'NEW', version: 1, allowedTransitions: ['IN_PROGRESS'] };
const IN_PROGRESS_V1 = { status: 'IN_PROGRESS', version: 1, allowedTransitions: ['RESOLVED', 'NEW'] };
const RESOLVED_V2 = { status: 'RESOLVED', version: 2, allowedTransitions: ['IN_PROGRESS'] };
const IN_PROGRESS_V3 = { status: 'IN_PROGRESS', version: 3, allowedTransitions: ['RESOLVED', 'NEW'] };

function setup(inquiry, onChangeStatus = vi.fn()) {
  const user = userEvent.setup({ delay: null });
  const view = render(<StatusActions inquiry={inquiry} onChangeStatus={onChangeStatus} />);
  const buttonNames = () => screen.queryAllByRole('button').map((b) => b.textContent);
  return { user, onChangeStatus, buttonNames, ...view };
}

describe('StatusActions: available actions', () => {
  it('offers only "Start progress" for a NEW inquiry (it cannot jump to Resolved)', () => {
    const { buttonNames } = setup(NEW_V1);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(buttonNames()).toEqual(['Start progress']);
  });

  it('offers "Reopen" for a RESOLVED inquiry', () => {
    const { buttonNames } = setup(RESOLVED_V2);
    expect(buttonNames()).toEqual(['Reopen']);
  });

  it('shows the buttons the server allows, whatever they are', () => {
    const { buttonNames } = setup(IN_PROGRESS_V1);
    expect(buttonNames()).toEqual(['Mark resolved', 'Move back to New']);
  });
});

describe('StatusActions: after clicking', () => {
  it('sends the chosen status and confirms the change', async () => {
    const onChangeStatus = vi.fn().mockResolvedValue({ ...IN_PROGRESS_V1, version: 2 });
    const { user, rerender } = setup(NEW_V1, onChangeStatus);

    await user.click(screen.getByRole('button', { name: 'Start progress' }));
    expect(onChangeStatus).toHaveBeenCalledWith('IN_PROGRESS');

    // The page passes the updated inquiry back in, as the real cache would.
    rerender(<StatusActions inquiry={{ ...IN_PROGRESS_V1, version: 2 }} onChangeStatus={onChangeStatus} />);
    expect(screen.getByRole('status')).toHaveTextContent('Status changed to In Progress.');
  });

  it('explains a conflict when someone else changed the inquiry first (stale data)', async () => {
    // This tab still shows IN_PROGRESS v1, but another tab already resolved it.
    const onChangeStatus = vi.fn().mockRejectedValue(
      new ApiError(409, 'STALE_RECORD', 'This inquiry was updated by someone else…', { current: RESOLVED_V2 }),
    );
    const { user, rerender, buttonNames } = setup(IN_PROGRESS_V1, onChangeStatus);

    await user.click(screen.getByRole('button', { name: 'Move back to New' }));

    // The page swaps in the latest record from the server (see useChangeStatus).
    rerender(<StatusActions inquiry={RESOLVED_V2} onChangeStatus={onChangeStatus} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('your change was not saved');
    expect(alert).toHaveTextContent('It is now Resolved');
    // The buttons now match the real, current status.
    expect(buttonNames()).toEqual(['Reopen']);
  });

  it('hides that warning once the inquiry changes again, so it never shows outdated information', async () => {
    const onChangeStatus = vi.fn().mockRejectedValue(
      new ApiError(409, 'STALE_RECORD', 'Conflict', { current: RESOLVED_V2 }),
    );
    const { user, rerender } = setup(IN_PROGRESS_V1, onChangeStatus);
    await user.click(screen.getByRole('button', { name: 'Move back to New' }));
    rerender(<StatusActions inquiry={RESOLVED_V2} onChangeStatus={onChangeStatus} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Someone reopens it; this tab receives version 3.
    rerender(<StatusActions inquiry={IN_PROGRESS_V3} onChangeStatus={onChangeStatus} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the server\'s reason when a move is refused', async () => {
    const onChangeStatus = vi.fn().mockRejectedValue(
      new ApiError(422, 'INVALID_TRANSITION', "An inquiry can't go from New to Resolved. Allowed: In Progress."),
    );
    const { user } = setup(NEW_V1, onChangeStatus);

    await user.click(screen.getByRole('button', { name: 'Start progress' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("can't go from New to Resolved");
  });

  it('disables the buttons while a change is being saved', async () => {
    let finish;
    const onChangeStatus = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { user } = setup(IN_PROGRESS_V1, onChangeStatus);

    await user.click(screen.getByRole('button', { name: 'Mark resolved' }));

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move back to New' })).toBeDisabled();
    finish({ ...RESOLVED_V2 });
  });
});
