# Gatekeeper mobile (Expo)

The Resident and Guard app in a single Expo project. The role comes from the membership you pick after you sign in. Admin-only memberships are told to use the web console.

- Expo SDK 58, expo-router (routes in `src/app`), TypeScript strict, TanStack Query 5
- The API contract is `docs/08-API-SPEC.md`. The design is `docs/09-UI-UX-DESIGN-SYSTEM.md` (tokens in `src/lib/theme.ts`, formatting in `src/lib/format.ts`, status map in `src/lib/status.ts`)

## Run

```bash
cd apps/mobile
npm install
cp .env.example .env        # then set EXPO_PUBLIC_API_URL (see below)
npx expo start              # scan the QR code with Expo Go (Android) or the Camera app (iOS)
```

The API must be running on port 4000 (see `apps/api`, or `docker compose up` from the repo root).

### `EXPO_PUBLIC_API_URL`

| Where the app runs | Value |
|---|---|
| iOS simulator / web on the same PC | `http://localhost:4000/api/v1` (the default) |
| Android emulator | `http://10.0.2.2:4000/api/v1` |
| Physical phone in Expo Go | `http://<PC LAN IP>:4000/api/v1`, e.g. `http://192.168.1.20:4000/api/v1` |

`EXPO_PUBLIC_WEB_URL` (default `http://localhost:8080`) is the admin web console link shown to admin-only accounts.

The phone and the PC must be on the same Wi-Fi. Find the IP with `ipconfig`, and allow inbound TCP 4000 in Windows Firewall. After you change `.env`, restart `npx expo start -c`.

## Demo accounts (seed, brief §9)

Society **Emerald Heights**, Bengaluru. In dev, the API returns the OTP as `devCode`, and the OTP screen shows it in a gold callout.

| Role | Phone | Name | Flat |
|---|---|---|---|
| Resident | 9000000002 | Rohan Mehta | A-101 |
| Resident | 9000000004 | Priya Iyer | B-201 |
| Guard | 9000000003 | Suresh Kumar | none |
| Admin | 9000000001 | Ananya Rao | none (gets the "use the web console" message with the web URL and sign-out) |

Gate passcodes: pre-approval `135790` (a guest for A-101) and staff `482913` (maid; each entry toggles check-in/check-out).

**Try the core flow on two devices:** the guard logs a Delivery for A-101. Rohan's Home shows the approval card at once, with a vibration and a banner. Rohan taps Approve. The guard's "Awaiting approval" card turns to Approved, and the guard taps Check in.

## Structure

```
src/app/_layout.tsx            fonts, QueryClient, session, splash, toast host
src/app/index.tsx              redirects to the right home
src/app/(auth)/                welcome · phone · otp · societies (picker / admin message / no membership)
src/app/(resident)/(tabs)/     home · visitors · community · services · profile
src/app/(resident)/            invite · tickets · ticket-new · ticket/[id] · amenities · amenity/[id] · bookings · staff · payments · notifications
src/app/(guard)/               gate · log · inside · expected · staff · alerts   (high-contrast console theme, Day/Night)
src/components/ui.tsx          Button, Card, Screen, StatusChip, Field, Chips, Sheet, Empty/Error/Skeleton, Toast, Logo, Threshold
src/components/visitor.tsx     approval hero card + visitor row
src/components/sos.tsx         2-second hold SOS with progress ring → type sheet → live status
src/components/invite.tsx      guest pass card + share text
src/components/staff.tsx       daily-help row with today's attendance (resident + guard)
src/lib/                       api (fetch + types) · session (SecureStore) · realtime (SSE) · hooks · theme · format · status
```

## Realtime

`react-native-sse` connects to `/events?token&societyId`. Each event invalidates the matching query: `visitors`, `sos`, `notices` or `notifications`. Residents get a vibration and an in-app banner on `visitor.requested`. Guards get them on `sos.raised`, plus a red banner that stays until the alert is acknowledged. While the stream is down, live lists poll every 5 s. The guard header shows "Live" or "Reconnecting…".

The guard console switches to Night automatically from 7 pm to 6 am IST. The sun/moon button in the header overrides it until the next automatic switch.

## Checks

```bash
npx tsc --noEmit
npx expo-doctor
npm run check:format         # format.ts assertions (docs/09 §8.4)
npx expo export --platform android && rm -rf dist
```

## Known gaps

- There are no push notifications (expo-notifications), so alerts reach a device only while the app is open.
- Guard staff check-in/out works only by passcode on the Gate tab (the API has no manual endpoint); the Staff tab says so and links to Gate.
- Not built: the tablet landscape rail, adding daily help to a flat, and SOS acknowledgement for admins on mobile.
