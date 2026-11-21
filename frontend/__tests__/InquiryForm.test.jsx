// The "record an inquiry" form: guidance before submitting, and how it
// handles each kind of answer from the server.
// onSubmit is a fake (vi.fn), so no real API is involved.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InquiryForm } from '@/components/inquiries/InquiryForm';
import { ApiError } from '@/lib/api';

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const user = userEvent.setup({ delay: null }); // type instantly
  render(<InquiryForm onSubmit={onSubmit} onCancel={vi.fn()} />);
  const fields = {
    customerName: screen.getByLabelText('Customer name'),
    contact: screen.getByLabelText('Contact'),
    subject: screen.getByLabelText('Subject'),
    description: screen.getByLabelText('Description'),
  };
  const submit = () => user.click(screen.getByRole('button', { name: 'Save inquiry' }));
  async function fillValid(overrides = {}) {
    const values = {
      customerName: 'Malini Gunawardena',
      contact: '+94 71 234 5678',
      subject: 'Wrong size delivered',
      description: 'Ordered medium, received small.',
      ...overrides,
    };
    for (const [name, value] of Object.entries(values)) {
      await user.clear(fields[name]);
      if (value) await user.type(fields[name], value);
    }
  }
  return { user, onSubmit, fields, submit, fillValid };
}

// A promise the test resolves or rejects when it chooses, to look at the
// form while a save is still in progress.
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('InquiryForm: before submitting', () => {
  it('shows an error on every empty field and does not call the API', async () => {
    const { onSubmit, fields, submit } = setup();

    await submit();

    expect(screen.getByText('Customer name is required.')).toBeInTheDocument();
    expect(screen.getByText('Contact is required.')).toBeInTheDocument();
    expect(screen.getByText('Subject is required.')).toBeInTheDocument();
    expect(screen.getByText('Description is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    // Accessibility: the field is marked invalid and focus moves to it.
    expect(fields.customerName).toHaveAttribute('aria-invalid', 'true');
    expect(fields.customerName).toHaveFocus();
  });

  it('rejects a contact that is neither an email nor a phone number', async () => {
    const { onSubmit, fields, submit, fillValid } = setup();

    await fillValid({ contact: 'abc' });
    await submit();

    expect(screen.getByText('Enter an email address or a Sri Lankan phone number.')).toBeInTheDocument();
    expect(fields.contact).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('gives phone-specific advice for a number in the wrong format', async () => {
    const { onSubmit, submit, fillValid } = setup();

    await fillValid({ contact: '077 123 456' }); // one digit short

    await submit();
    expect(
      screen.getByText('Enter a Sri Lankan phone number, e.g. 077 123 4567 or +94 77 123 4567.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a customer name with digits or symbols', async () => {
    const { onSubmit, fields, submit, fillValid } = setup();

    await fillValid({ customerName: 'Nimal 123' });
    await submit();

    expect(screen.getByText(/Customer name can only contain letters/)).toBeInTheDocument();
    expect(fields.customerName).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a name with an apostrophe and a +94 phone number', async () => {
    const { onSubmit, submit, fillValid } = setup();

    await fillValid({ customerName: "Mary-Jane O'Neil", contact: '+94 77 123 4567' });
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('clears an error as soon as the field is fixed', async () => {
    const { user, fields, submit, fillValid } = setup();
    await fillValid({ contact: 'abc' });
    await submit();
    expect(screen.getByText('Enter an email address or a Sri Lankan phone number.')).toBeInTheDocument();

    await user.clear(fields.contact);
    await user.type(fields.contact, 'customer@example.com');

    expect(screen.queryByText('Enter an email address or a Sri Lankan phone number.')).not.toBeInTheDocument();
  });

  it('sends trimmed values once everything is valid', async () => {
    const { onSubmit, submit, fillValid } = setup();

    await fillValid({ customerName: '  Malini Gunawardena  ' });
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      customerName: 'Malini Gunawardena',
      contact: '+94 71 234 5678',
      subject: 'Wrong size delivered',
      description: 'Ordered medium, received small.',
    });
  });
});

describe('InquiryForm: while saving and after the server answers', () => {
  it('locks the form while saving, so a double click cannot submit twice', async () => {
    const save = deferred();
    const { user, onSubmit, submit, fillValid } = setup(vi.fn(() => save.promise));
    await fillValid();

    await submit();
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toBeDisabled();
    await user.click(button); // a second click while saving
    expect(onSubmit).toHaveBeenCalledTimes(1);

    save.resolve();
  });

  it('shows server validation messages on the matching fields', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid.', {
        subject: 'Subject must be 150 characters or fewer.',
      }),
    );
    const { fields, submit, fillValid } = setup(onSubmit);
    await fillValid();

    await submit();

    expect(await screen.findByText('Subject must be 150 characters or fewer.')).toBeInTheDocument();
    expect(fields.subject).toHaveFocus();
  });

  it('links to the existing inquiry when the server reports a duplicate', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(409, 'DUPLICATE_INQUIRY', 'This inquiry was already recorded a few minutes ago.', {
        existingId: 'abc-123',
      }),
    );
    const { submit, fillValid } = setup(onSubmit);
    await fillValid();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('already recorded');
    expect(screen.getByRole('link', { name: 'View the existing inquiry' })).toHaveAttribute('href', '/inquiries/abc-123');
  });

  it('keeps everything typed and allows retrying when saving fails', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', "Can't reach the server."))
      .mockResolvedValueOnce(undefined);
    const { fields, submit, fillValid } = setup(onSubmit);
    await fillValid();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server.");
    expect(fields.customerName).toHaveValue('Malini Gunawardena');
    expect(fields.description).toHaveValue('Ordered medium, received small.');

    await submit(); // try again
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
