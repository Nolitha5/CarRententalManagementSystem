export async function request(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not connect to the booking API. Check that the API is running and try again.');
  }

  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new Error('The booking API is unavailable. Check that the API is running and try again.');
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request failed. Try again.');
  return data;
}

export const currency = new Intl.NumberFormat('en-ZA', {
  style: 'currency', currency: 'ZAR', maximumFractionDigits: 0
});
