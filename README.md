# FLORAROAD Car Rental

Sqrock IT Solutions web development internship · Task 1

FLORAROAD uses React, HTML and CSS for the customer interface, Express for the booking API and SQLite for shared storage. The starter fleet and rates are sample inventory. The booking workflow writes to the server database.

## Run locally

Install Node.js 24 or later, then run these commands from the project folder.

```powershell
npm install
npm run build
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). For React development, run `npm run api` and `npm run dev` in separate terminals and open the Vite URL.

## Customer workflow

1. Browse the fleet and filter by model, daily budget or vehicle type.
2. Pick rental dates and an available vehicle, then enter your contact details and submit the request.
3. Keep the reference shown after submission. New requests are pending until the operator confirms them. Pending and confirmed bookings hold the selected dates. The return date is available as another booking's pick-up date.

## Operator dashboard

This is the single bonus feature. Create a local `.env` from `.env.example`, set `ADMIN_PASSWORD` to a unique password of at least 12 characters, and restart the server. Use a quoted value if the password includes spaces or a hash character. Open [Operator dashboard](http://127.0.0.1:3000/?operator) from the footer, then sign in. The operator can review, confirm or cancel bookings. Cancellation releases the vehicle's dates.

The database is created at `data/floraroad.sqlite`. All browsers connected to the same server use that database. Booking contact details are visible in the password-protected dashboard. The footer contact link opens an email draft addressed to sibiyanolitha5@gmail.com.

## Submission screenshots

- [Desktop homepage and fleet](screenshots/desktop.png)
- [Mobile layout](screenshots/mobile.png)
- [Booking confirmation](screenshots/booking.png)

## Image sources

- [Road photograph on Unsplash](https://images.unsplash.com/photo-1500530855697-b586d89ba3ee)
- [Toyota Corolla photograph on Unsplash](https://images.unsplash.com/photo-1638618164682-12b986ec2a75)
- [Mazda CX-5 photograph from Zigwheels](https://www.zigwheels.co.id/mobil-bekas/mazda/cx-5/kuro-671246/)
- [Ford Ranger photograph from CarExpert](https://images.carexpert.com.au/resize/1920/-/cms/v1/media/2020-07-ford-ranger-wildtrak-bi-turbo-07.jpg)
