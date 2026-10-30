# Accessibility and visual design: what Apple asks, and how Jue measures up

Researched 30 October 2026, iOS only. Android comes after the iOS submission.

Each rule has a level:

- **Apple says**: written in Apple's Human Interface Guidelines (HIG). App Review expects apps to follow the HIG, but a miss on one of these is not a named rejection reason.
- **Declared**: something you tell the App Store in App Store Connect. The answers have to be true.
- **Our choice**: WCAG 2.2 AA, which Apple's own contrast guidance points to. Not an Apple rule.

The pages were read from Apple's published HIG content on the date above. The figures in the tables are Apple's, quoted from those pages.

## 1. What Apple says

### Text size (HIG: Typography, Accessibility)
- Follow the recommended default and minimum text sizes, for custom and system fonts. **iOS: default 17 pt, minimum 11 pt.**
- "Ideally, give people the option to enlarge text by at least 200 percent," either with custom UI or by adopting Dynamic Type.
- Dynamic Type has a standard range (xSmall to xxxLarge) and five larger accessibility sizes (AX1 to AX5). At AX5 Body is 53 pt and Caption 2 is 40 pt, so layouts have to reflow, not truncate.
- Thin weights need larger sizes. Custom fonts must respond to Dynamic Type and Bold Text the same way system fonts do.
- Source: [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

### Contrast (HIG: Accessibility, Color)
Apple points to WCAG Level AA, and its Accessibility Inspector uses these values:

| Text size | Weight | Minimum contrast |
|---|---|---|
| Up to 17 pt | all | 4.5:1 |
| 18 pt | all | 3:1 |
| any | bold | 3:1 |

- If the app does not meet this by default, it should at least meet it when **Increase Contrast** is on.
- Check light and dark appearances separately.
- Apple names text and icons. It gives no number for borders and shapes. WCAG 2.2 criterion 1.4.11 asks for 3:1 on the parts of a control needed to identify it.

### Colour alone (HIG: Color, Accessibility)
- "Avoid relying solely on color to differentiate between objects, indicate interactivity, or communicate essential information." Use text labels or glyph shapes too.
- Apple names red-green and **blue-orange** as hard pairings for people with colour blindness.
- Colours should work in light, dark and increased-contrast contexts. Custom colours need light, dark and increased-contrast variants. System colours already have them.
- Source: [Color](https://developer.apple.com/design/human-interface-guidelines/color)

### Touch targets (HIG: Accessibility)
- iOS control size: **default 44 × 44 pt, minimum 28 × 28 pt.**
- About 12 pt of padding around bezelled elements, about 24 pt around elements with no bezel.

### Motion and screen reader (HIG: Accessibility)
- With **Reduce Motion** on, cut automatic and repetitive animation.
- Describe the interface and content for **VoiceOver**.

### Declared in App Store Connect: Accessibility Nutrition Labels
- Optional today. Apple has said it will become a requirement later and gave no date.
- You declare support per feature and per device: VoiceOver, Voice Control, Larger Text, Dark Interface, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, Audio Descriptions.
- A feature may be claimed only if users can finish **all the app's common tasks** with it (first launch, sign-in, settings, the core functions). App Review can ask you to correct a label that looks misleading.
- You can edit labels after release without a new submission.
- Source: [Overview](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/), [Manage](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/manage-accessibility-nutrition-labels/)

## 2. How Jue measures up

Measured from the code on 30 October 2026, before the fixes in section 3. Contrast was computed from the colours in `src/theme/colors.ts`. Nothing here has been checked on the phone yet.

### Contrast, text (limit 4.5:1)
All text pairs pass in light and dark, except one:

| Pair | Ratio | Result |
|---|---|---|
| "Running" chip, light theme (`#1a7f37` on `#e3f4e8`) | 4.44:1 | **Fails by 0.06** |

Lowest passing text: muted text on the light background 5.30:1; neutral chip, light, 4.79:1.

### Contrast, shapes (limit 3:1, our choice)
- **Light theme: card and field borders are 1.36:1.** Dark theme 1.41:1. This matters for the search box and the dropdown fields, where the border is what shows where to tap. It matters less for card edges, which also differ in background.
- **Tier stripe.** Against a white card, Free (2.31:1) and Business Critical (2.25:1) fail 3:1. The others pass, and all pass in dark. Because the stripe is not the only signal (see below), this matters less if the tier is also written out.

### Colour alone
- **Status** uses an icon and a text label as well as colour. Good.
- **Tier is shown by the stripe colour only.** The tier name is read out by VoiceOver but is not visible on the card. Apple asks for a visible second signal, and names blue-orange as a hard pairing, which is Free next to Business Critical. Simulated colour blindness (my rule of thumb: a colour distance under about 20 is hard to tell apart) puts three pairs near that line: Free and Professional with tritanopia (16), Business Critical and Enterprise with tritanopia (17), and Professional and Enterprise with deuteranopia (18). The rule of thumb is mine, not Apple's.

### Text size and fonts
- Sizes in use: 11 (one place, the licence text), 12 (three), 13 (four), 14 (one), 16 (21 places), then 18 to 32. All are at or above Apple's 11 pt minimum.
- Most text is 16, and Apple's default is 17.
- Text uses the system font (SF). Two places use Menlo: password and licence text. React Native scales text by default and we never turned it off, so Dynamic Type should work, but nothing caps or tests it.
- **Not verified:** how each screen looks at the accessibility sizes (AX1 to AX5), and whether Bold Text takes effect.

### Touch targets
Buttons, tags, filter chips, switch rows, the copy button and the close buttons are all 44 pt high or more. The whole card is pressable. Nothing found under the 44 pt default.

### Motion
Only system spinners animate, and the app does not read Reduce Motion. Not verified.

### VoiceOver
Cards, the stripe, switches and buttons have labels, and the stripe is hidden from VoiceOver. A full pass through every screen is **not done**.

## 3. Fixes

Done on 30 October 2026, with `src/theme/contrast.test.ts` checking the contrast from the real colour tokens:

1. **Tier written out on the card**, as text next to the stripe, so colour is no longer the only sign. Done.
2. **Field edges at 3:1.** A new `control` colour (light `#6f8397`, dark `#6a85a0`) is on the search boxes, text inputs, dropdowns, the filter button, the tag buttons and the operations filter chips. 3.28:1 or more on the page, card and chip backgrounds. Card edges keep the lighter `border`. Done.
3. **Light "Running" chip** text darkened to `#187335` (5.19:1). Done.
4. **Body text at 17 pt.** All 16 pt text is now 17, and text with no size set (React Native's default is 14) now uses 17 through `src/ui/Text.tsx`. Smaller explicit sizes (11 to 13 pt, for details and captions) are unchanged and are at or above Apple's 11 pt minimum. Done.

Still to do, and needing the phone:

5. **Test the large sizes** (up to AX5) on every screen, and cap or reflow any layout that breaks. Text is bigger now, so this matters more.
6. **Increased contrast.** The app's own colours clear the minimum in both themes, so this is only needed if you want to go beyond it.
7. **Run VoiceOver, Voice Control and Reduce Motion through the common tasks**, then fill in the Accessibility Nutrition Labels honestly.
8. **Optional:** make the stripe 3:1 against a white card by darkening Free and Business Critical in the light theme. The tier is now written out, so this is cosmetic.

## 4. Not covered yet
- The App Review Guidelines text, beyond what the HIG says.
- The EU Accessibility Act, ADA and EN 301 549. Deferred by choice. Apple first.
- Android: Material Design and TalkBack. After iOS is submitted.
