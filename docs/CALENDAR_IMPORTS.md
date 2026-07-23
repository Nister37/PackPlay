# Calendar imports

PackPlay imports RFC 5545 iCalendar feeds into group activities. Generic feeds,
TeamSnap, and GameChanger use the same connector; the provider value records the
source for the client.

## API

All routes require JWT authentication and group membership. Preview, connect,
manual sync, and disconnect operations additionally require an owner or admin
role.

| Method   | Route                                          | Purpose                                  |
| -------- | ---------------------------------------------- | ---------------------------------------- |
| `POST`   | `/groups/:groupId/calendar-feeds/preview-url`  | Preview an HTTPS feed                    |
| `POST`   | `/groups/:groupId/calendar-feeds/preview-file` | Preview supplied iCalendar text          |
| `POST`   | `/groups/:groupId/calendar-feeds/import-file`  | Import reviewed iCalendar text once      |
| `POST`   | `/groups/:groupId/calendar-feeds`              | Connect and initially synchronize a feed |
| `GET`    | `/groups/:groupId/calendar-feeds`              | List feed status without private URLs    |
| `POST`   | `/groups/:groupId/calendar-feeds/:feedId/sync` | Synchronize immediately                  |
| `DELETE` | `/groups/:groupId/calendar-feeds/:feedId`      | Disable future synchronization           |

Connected feeds synchronize hourly. Imports are idempotent by feed, UID, and
recurrence ID. Newer source changes update the associated activity, including
cancellations. Disconnecting a feed retains already imported activities.

## Security

Only HTTPS URLs without embedded credentials or custom ports are accepted.
Private, loopback, link-local, reserved, and non-routable destinations are
rejected before each redirect. Responses have a 5 MB limit and a 15 second
timeout.

Feed URLs are encrypted with AES-256-GCM and never returned by the API. Set
`CALENDAR_FEED_ENCRYPTION_KEY` to a secret of at least 16 characters. Existing
deployments fall back to `JWT_SECRET`, but a separate production key is
recommended. URL hashes are stored only for duplicate detection.

## Supported calendar behavior

The parser supports folded lines, escaped text, UTC dates, all-day dates, IANA
time zones, `SEQUENCE`, `STATUS:CANCELLED`, `RECURRENCE-ID`, `EXDATE`, and daily
or weekly `RRULE` expansion. Recurrence is bounded to 1,000 occurrences and a
two-year horizon.
