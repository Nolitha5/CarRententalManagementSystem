import React, { useState } from 'react';
import { request } from './api.js';

function authorization(password) {
  const bytes = new TextEncoder().encode('admin:' + password);
  return 'Basic ' + btoa(String.fromCharCode(...bytes));
}

export default function Operator() {
  const [access, setAccess] = useState('');
  const [bookings, setBookings] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(header) {
    setBusy(true);
    setFeedback('');
    try {
      setBookings(await request('/api/admin/bookings', { headers: { Authorization: header } }));
      setAccess(header);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function update(reference, status) {
    setBusy(true);
    setFeedback('');
    try {
      await request('/api/admin/bookings/' + encodeURIComponent(reference), {
        method: 'PATCH',
        headers: { Authorization: access, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setBookings(current => current.map(booking =>
        booking.reference === reference ? { ...booking, status } : booking));
      setFeedback(status === 'confirmed' ? 'Booking confirmed.' : 'Booking cancelled.');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="wrap operator">
    <p><a href="/">Back to FLORAROAD</a></p>
    <h1>Manage bookings</h1>
    {!access ? (
      <form className="operator-login" onSubmit={event => {
        event.preventDefault();
        load(authorization(event.currentTarget.elements.password.value));
      }}>
        <label className="full">Operator password
          <input type="password" name="password" autoComplete="current-password" maxLength={256} required />
        </label>
        <button className="button full" disabled={busy}>Sign in</button>
      </form>
    ) : <>
      <div className="operator-actions">
        <button className="button small" disabled={busy} onClick={() => load(access)}>Refresh bookings</button>
        <button className="button small" disabled={busy} onClick={() => {
          setAccess('');
          setBookings([]);
          setFeedback('');
        }}>Sign out</button>
      </div>
      {!bookings.length && <p>No bookings yet.</p>}
      <div className="operator-list">
        {bookings.map(booking => <article className="operator-card" key={booking.reference}>
          <div className="card-meta"><h3>{booking.model}</h3><span className="status">{booking.status}</span></div>
          <p>{booking.pickup} to {booking.return_date}</p>
          <p>{booking.customer}<br />{booking.email}<br />{booking.phone}</p>
          <p className="reference">{booking.reference}</p>
          <div className="operator-actions">
            {booking.status === 'pending' && <button className="button small" disabled={busy}
              onClick={() => update(booking.reference, 'confirmed')}>Confirm booking</button>}
            {booking.status !== 'cancelled' && <button className="button small secondary" disabled={busy}
              onClick={() => update(booking.reference, 'cancelled')}>Cancel booking</button>}
          </div>
        </article>)}
      </div>
    </>}
    <p role="status">{feedback}</p>
  </main>;
}
