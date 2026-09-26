# Room Reservation System

A browser-based prototype for booking campus rooms — students and staff request a time slot, admins approve or reject it. No backend: all data lives in `localStorage`.

## Features

- **Landing page** (`index.html`) — marketing/info page with panels for Features, How It Works, Trust & Safety, and FAQ.
- **Auth flows** — Login and Forgot Password pages, backed by `auth.js`. Accounts are created by the school admin — there is no public self-registration.
- **Account management** — admins can approve, reject, block, or reactivate accounts.
- **Room booking** — four fixed daily time blocks per room; live status per slot (Open / Pending / Booked); conflict checking prevents double-booking.
- **Booking approval workflow** — admins approve, reject, or cancel booking requests.
- **Role-based dashboard** (`dashboard.html`) — different views/permissions for student leaders, teachers, staff, and admins (users, rooms, bookings, stats, profile, password reset requests).
- **Password reset requests** — users request a reset; an admin resolves it and sets a new password.
- **Theme toggle** — dark/light mode, persisted across sessions via `localStorage`.
- **Animated background** — subtle canvas-based drifting node field with cursor parallax, respects `prefers-reduced-motion`.

## Tech Stack

- Plain HTML/CSS/JS (no framework, no build step)
- [Bootstrap 5.3.3](https://getbootstrap.com/) (via CDN) for layout/components
- `localStorage` as the persistence layer (seeded with a default admin and sample bookings)

## File Structure

```
index.html              Landing page
login.html               Sign-in page
forgot-password.html      Password reset request page
dashboard.html            Main app shell (rooms, bookings, users, stats, profile)
auth.js                   User accounts, sessions, login, password reset
home.js                   Landing page interactions
script.js                 Dashboard logic: rooms, bookings, users, stats, modals
style.css                 All styling
theme.js                  Dark/light theme toggle
bg-field.js               Animated canvas background
```

## Getting Started

1. Clone/download the project.
2. Open `index.html` in a browser (no server or build step required).
3. Log in with the seeded admin account:
   - **Email:** `admin@gmail.com`
   - **Password:** `admin123`
4. New user accounts are created by an admin from the dashboard — there is no public sign-up page.

## Notes on Migration

- Any account still `pending` or `rejected` from the old self-registration flow is automatically moved to `blocked` on load, so admins can review and either remove or reactivate it from Manage Users.

## Notes / Limitations

- Data is stored per-browser in `localStorage`; it is not shared across devices or persisted to a real database.
- Passwords are stored in plain text in `localStorage` — this is a prototype, **not** suitable for production or real credentials for now.
