# VITO Physio iOS and App Store release plan

## Current native preparation

The repository now contains a Capacitor iOS workspace under `ios/` with the bundle identifier `com.vitophysio.app`, the display name `Vito Physio`, Swift Package Manager dependencies, and the VITO app icon. The web build is synchronized into the native project with:

```bash
pnpm ios:sync
```

The configured production web endpoint is `https://vito-physio.vercel.app`. This is intentional for the current TanStack Start application because the deployed application provides the server-rendered route shell and authenticated web behavior. The native shell is not signed or distributed yet.

## Apple account stages

Apple provides a free developer account for access to tools and testing on the developer’s own devices. App Store distribution and TestFlight require Apple Developer Program membership, which Apple currently lists at **$99 per year**. The membership also unlocks App Store Connect, distribution certificates, provisioning, TestFlight, and App Store submission capabilities.

The account holder will need to:

1. Enroll in the Apple Developer Program and complete identity or organization verification.
2. Register the App ID `com.vitophysio.app` in Certificates, Identifiers & Profiles.
3. Create or enable the required signing certificates and provisioning profiles.
4. Create the VITO Physio app record in App Store Connect with the matching bundle ID.
5. Add the app privacy details, age rating, category, support URL, privacy-policy URL, screenshots, description, and review notes.
6. Provide App Review with a working demo account or an equivalent review path because VITO Physio contains authenticated features.

## Build and TestFlight sequence

On a Mac with Xcode installed and the Apple account configured, the release sequence is:

```bash
pnpm ios:sync
pnpm ios:open
```

In Xcode, select the `App` target, choose the Apple development team, confirm the bundle ID, configure automatic signing, and run the app on an iPhone or simulator. After device testing, choose **Product → Archive**, validate the archive, and upload it to App Store Connect. TestFlight can then distribute the build to internal testers and, after the required beta review, external testers.

For a command-line build on a configured Mac, the repository also provides:

```bash
pnpm ios:build
```

The current Linux sandbox cannot execute the final Xcode archive or signing step because that requires macOS, Xcode, an Apple signing identity, and the associated provisioning configuration.

## App Store readiness items

VITO Physio should be reviewed before submission for privacy, account access, user-generated social content, messaging, clinical information, and any camera or photo-upload behavior. The app must have a public privacy policy and a clear explanation of how user and health-related information is handled. The App Review submission should include test credentials, a description of staff and athlete roles, and instructions for reaching the messaging, case-management, and research features.

The native wrapper should also offer meaningful app value beyond being a thin website shell. The current product has authenticated case management, messaging, profile and social features, clinician workspaces, and Research & Analytics. These should be tested as a coherent mobile experience before submission, with special attention to Safari/WebView differences, photo permissions, keyboard behavior, safe-area spacing, offline states, and navigation history.

## References

1. [Apple Developer Program](https://developer.apple.com/programs/) — account access, membership, TestFlight, and distribution benefits.
2. [Apple TestFlight](https://developer.apple.com/testflight/) — internal and external beta distribution workflow.
3. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — review, account access, privacy, safety, and minimum-functionality considerations.
4. [Create an App Store provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/) — distribution provisioning workflow.
