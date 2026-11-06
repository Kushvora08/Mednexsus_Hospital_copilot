# MedNexsus — React Native

The frontend now uses React Native components and StyleSheet styling with Expo for Android, iOS, and web. No HTML screens or WebView wrappers are used. The original frontend and tests are archived in legacy/.

## Run

Uses Expo SDK 58, React Native 0.88.1, and React 19.3.0. Requires Node.js 22.13+ and npm. Dependency versions follow the [Expo SDK compatibility reference](https://docs.expo.dev/versions/v58.0.0/).

```sh
npm install
npm start
```

The start command explicitly selects Expo Go, clears the old bundler cache, and advertises your computer's local network address. Connect your computer and phone to the same Wi-Fi. Open the SDK 58-compatible Expo Go app on Android and scan the QR code, or scan it with the Camera app on iPhone. Keep the terminal running while using the app.

`npm run android` opens Expo Go on a connected Android device or emulator. `npm run ios` targets an iOS simulator and requires macOS. Use `npm run web` for a browser preview. Separate native builds use `npm run build:android` or `npm run build:ios`; those commands regenerate native configuration before building and are not required for Expo Go.

If the QR code opens Expo Go but the project cannot connect, try `npm run start:tunnel` instead. Expo may prompt to install its tunneling helper the first time. The phone must have internet access. A `localhost` or `127.0.0.1` project URL points to the phone itself and will not connect to this computer.

After an SDK upgrade, close the previous project in Expo Go and scan the new QR code. This project uses SDK 58; its Expo Go client must support SDK 58 as well.

## Demo access

Use the patient/doctor demo buttons or these accounts:

| Role | Email | Password |
| --- | --- | --- |
| Patient | demo@hospitalcopilot.local | demo123 |
| Doctor | doctor@mednexsus.local | doctor123 |

Separate patient and doctor registration is supported. Patient registration can optionally include sample reports.

## Features

- Patient dashboard with demo health score, body system markers, clinical reasoning, and alerts.
- TXT/CSV report import, lab parsing, explanations, doctor questions, saved reports, and trends.
- Local knowledge cards with source links and patient context.
- Medicine explanations, interaction rules, allergy checks, and kidney monitoring warnings.
- Local appointments, consultation summaries, editable profiles, and health timelines.
- Doctor patient queue, patient selection, consultation briefs, safety review, appointment queue, and saved SOAP drafts.
- Warm ivory and forest-green theme based on the selected mobile design.
- Patient home with report upload, clickable recent reports, and upcoming appointments.
- Four mobile destinations: Home, Reports, Care, and Profile. Care contains medicines, appointments, health information, timeline, and safety checks. Wide displays retain the full sidebar; doctors retain their clinical workspace.

## Data and limitations

Clinical rules and reference ranges were carried over from the original MVP into src/clinical.js; they have not been clinically validated. Knowledge answers use local cards, without a live retrieval/LLM service. PDF/image OCR, live bookings, and speech recognition are not connected. SOAP output is a draft built from entered text and saved records.

Native devices use AsyncStorage. Web uses the original browser storage keys: existing accounts remain accessible when served on the same browser origin. Phone and browser data do not synchronize. Sessions, profiles, reports, appointments, and notes persist locally. Demo authentication stores plain-text passwords; use sample information only. There is no production backend or authentication.

## Verification

```sh
npm test
npx expo install --check
npm run build:web
npx expo export --platform android --output-dir dist-android
```

Native export checks bundling; it does not replace testing on an emulator or phone.

This educational demo must not be used for diagnosis, treatment, or emergency triage.
