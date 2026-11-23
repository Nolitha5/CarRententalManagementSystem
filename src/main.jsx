import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { currency, request } from './api.js';
import Operator from './Operator.jsx';
import './styles.css';

const contact = 'sibiyanolitha5@gmail.com';

function Brand() {
  return <a className="brand" href="#home">FLORAROAD<span> CAR RENTAL</span></a>;
}

function Fleet({ vehicles, datesChecked, loading, error, onBook }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');
  const matches = vehicles.filter(car =>
    car.model.toLowerCase().includes(search.trim().toLowerCase()) &&
    (!type || car.type === type) && (!price || car.rate <= Number(price))
  );

  return <section className="wrap fleet" id="fleet" aria-labelledby="fleet-heading">
    <p className="eyebrow">The fleet</p>
    <h2 id="fleet-heading">Find your ride.</h2>
    <div className="filters">
      <label>Search by model<input type="search" placeholder="e.g. Toyota Corolla"
        value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>Vehicle type<select value={type} onChange={event => setType(event.target.value)}>
        <option value="">All types</option><option>Sedan</option><option>SUV</option><option>Pickup</option>
      </select></label>
      <label>Daily budget<select value={price} onChange={event => setPrice(event.target.value)}>
        <option value="">Any price</option><option value="600">Up to R600</option>
        <option value="900">Up to R900</option><option value="1200">Up to R1 200</option>
      </select></label>
    </div>
    <p className="muted results" role="status">
      {error || (loading ? 'Checking the fleet…' : matches.length
        ? matches.length + (matches.length === 1 ? ' vehicle' : ' vehicles')
        : 'No matching vehicles. Try different filters.')}
    </p>
    <div className="cards">
      {matches.map(car => <article className="card" key={car.id}>
        <img src={'/assets/' + car.id + '.jpg'} alt={car.model} width="640" height="390" />
        <div className="card-body">
          <div className="card-meta">
            <span className="muted">{car.featured ? 'Featured · ' : ''}{car.type}</span>
            <span className={'status' + (car.available ? '' : ' unavailable')}>
              {car.available ? (datesChecked ? 'Available for dates' : 'Available to book') : 'Unavailable'}
            </span>
          </div>
          <h3>{car.model}</h3>
          <p className="specs muted">{car.fuel} · {car.seats} seats</p>
          <div className="card-bottom">
            <span className="rate"><strong>{currency.format(car.rate)}</strong> <span className="muted">/ day</span></span>
            <button type="button" className="button small" disabled={!car.available || loading}
              aria-label={'Book ' + car.model} onClick={() => onBook(car.id)}>
              {car.available ? 'Book car' : 'Unavailable'}
            </button>
          </div>
        </div>
      </article>)}
    </div>
  </section>;
}

function nextDate(date) {
  if (!date) return '';
  const next = new Date(date + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function App() {
  const [fleet, setFleet] = useState({ vehicles: [], today: '', query: null });
  const [fleetError, setFleetError] = useState('');
  const [pickup, setPickup] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const vehicleInput = useRef(null);
  const minReturn = nextDate(pickup || fleet.today);
  const datesReady = Boolean(pickup && returnDate && pickup >= fleet.today && pickup < returnDate);
  const query = datesReady ? '?' + new URLSearchParams({ pickup, returnDate }) : '';
  const loading = fleet.query !== query && !fleetError;
  const available = fleet.vehicles.filter(car => car.available);
  const selection = available.some(car => car.id === vehicle) ? vehicle : '';

  useEffect(() => {
    const controller = new AbortController();
    request('/api/vehicles' + query, { signal: controller.signal }).then(data => {
      setFleet({ ...data, query });
      setFleetError('');
    }).catch(error => {
      if (error.name !== 'AbortError') setFleetError(error.message);
    });
    return () => controller.abort();
  }, [query, refresh]);

  function chooseVehicle(id) {
    setVehicle(id);
    setFeedback('');
    window.location.hash = 'booking';
    vehicleInput.current?.focus({ preventScroll: true });
  }

  async function book(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setFeedback('');
    try {
      const result = await request('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      form.reset();
      setVehicle('');
      setPickup('');
      setReturnDate('');
      setFeedback('Booking request received. Status: pending. Reference: ' + result.reference);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setRefresh(value => value + 1);
      setBusy(false);
    }
  }

  return <div id="home">
    <header className="site-header"><div className="wrap header-inner">
      <Brand />
      <nav aria-label="Main navigation">
        <a href="#fleet">Fleet</a><a href="#contact">Contact</a><a className="button small" href="#booking">Book a car</a>
      </nav>
    </div></header>
    <main>
      <section className="hero" aria-labelledby="hero-heading"><div className="wrap">
        <p className="eyebrow">Cape Town car rental</p>
        <h1 id="hero-heading">Good roads<br />are ahead.</h1>
        <p className="hero-copy">FLORAROAD rents city cars, SUVs and pickups from Cape Town. Choose a car, pick your dates and send a booking request.</p>
        <a className="button" href="#fleet">Explore the fleet</a>
      </div></section>
      <Fleet vehicles={fleet.vehicles} datesChecked={Boolean(fleet.query)} loading={loading} error={fleetError} onBook={chooseVehicle} />
      <section className="booking-section" id="booking" aria-labelledby="booking-heading">
        <div className="wrap booking-layout">
          <div><p className="eyebrow">Reservations</p><h2 id="booking-heading">Book your car.</h2>
            <p>Enter your dates to check availability. The operator reviews each booking request.</p>
          </div>
          <form onSubmit={book} onChange={() => setFeedback('')}>
            <label>Pick-up date<input type="date" name="pickup" min={fleet.today} value={pickup}
              onChange={event => setPickup(event.target.value)} required /></label>
            <label>Return date<input type="date" name="returnDate" min={minReturn} value={returnDate}
              onChange={event => setReturnDate(event.target.value)} required /></label>
            <label className="full">Vehicle<select name="vehicle" value={selection} ref={vehicleInput}
              onChange={event => setVehicle(event.target.value)} required>
              <option value="">{available.length ? 'Choose a car' : 'No vehicles available'}</option>
              {available.map(car => <option key={car.id} value={car.id}>
                {car.model} · {currency.format(car.rate)} / day
              </option>)}
            </select></label>
            <label className="full">Full name<input name="customer" autoComplete="name" minLength={2} maxLength={100} required /></label>
            <label>Email<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
            <label>Phone<input type="tel" name="phone" autoComplete="tel" maxLength={30} required /></label>
            <button className="button full" type="submit" disabled={busy || loading || !!fleetError}>
              {busy ? 'Submitting…' : 'Submit booking request'}
            </button>
            {feedback && <p className="full confirmation" role="status">{feedback}</p>}
          </form>
        </div>
      </section>
    </main>
    <footer id="contact"><div className="wrap footer-inner">
      <div><Brand /><p>Cape Town, South Africa</p></div>
      <div><strong>Contact</strong><p><a href={'mailto:' + contact}>{contact}</a></p></div>
      <a href="?operator">Operator dashboard</a>
    </div></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('operator') ? <Operator /> : <App />);
