# Room Reservation System

A browser-based prototype for booking campus rooms — students and staff request a time slot, admins approve or reject it. No backend: all data lives in `localStorage`.

## Features

- **Landing page** (`index.html`) — marketing/info page with panels for Features, How It Works, Trust & Safety, and FAQ.
- **Auth flows** — Login, Register, and Forgot Password pages, backed by `auth.js`.
- **Signup screening** — new accounts are auto-flagged for spam/troll signals (placeholder names, disposable email domains, rapid-fire signups) and require a profile photo, with results shown to admins as *Looks Legit / Needs Review / Likely Fake*.
- **Account approval workflow** — registrations are `pending` until an admin approves, rejects, blocks, or reactivates them.
- **Room booking** — four fixed daily time blocks per room; live status per slot (Open / Pending / Booked); conflict checking prevents double-booking.
- **Booking approval workflow** — admins approve, reject, or cancel booking requests.
- **Role-based dashboard** (`dashboard.html`) — different views/permissions for student leaders, teachers, staff, and admins (users, rooms, bookings, stats, profile, password reset requests).
- **Password reset requests** — users request a reset; an admin resolves it and sets a new password.

## Tech Stack

- Plain HTML/CSS/JS (no framework, no build step)
- [Bootstrap 5.3.3](https://getbootstrap.com/) (via CDN) for layout/components
- `localStorage` as the persistence layer (seeded with a default admin and sample bookings)

## File Structure

```
index.html              Landing page
login.html               Sign-in page
register.html             Registration page (+ signup screening, photo capture)
forgot-password.html      Password reset request page
dashboard.html            Main app shell (rooms, bookings, users, stats, profile)
auth.js                   User accounts, sessions, registration, login, password reset
home.js                   Landing page interactions
script.js                 Dashboard logic: rooms, bookings, users, stats, modals
style.css                 All styling
```

## Getting Started

1. Clone/download the project.
2. Open `index.html` in a browser (no server or build step required).
3. Log in with the seeded admin account:
   - **Email:** `admin@school.com`
   - **Password:** `admin123`
4. Or register a new account — it will sit as `pending` until an admin approves it.

## Notes / Limitations

- Data is stored per-browser in `localStorage`; it is not shared across devices or persisted to a real database.
- Passwords are stored in plain text in `localStorage` — this is a prototype, **not** suitable for production or real credentials.
- Intended as a school-project/prototype demo, not a hardened, deployable system.
