# Privacy Policy – Live Captions Translator

**Effective Date: November 15, 2025**

Live Captions Translator ("the Extension," "we," "our," or "us") is committed to protecting the privacy and security of our users ("you," "your"). This Privacy Policy explains how we handle data when you use the Live Captions Translator Chrome extension. By installing or using the Extension, you agree to the practices described in this policy.

## 1. Overview

Live Captions Translator is a Chrome extension designed to provide real-time transcription, translation, and live captions for audio from the browser tab you select. The extension captures audio, processes it locally, and optionally sends it to a user-configured AI API (Google Gemini AI) for transcription and translation. All features are designed to enhance accessibility, comprehension, and productivity when consuming audio content online.

We understand that privacy is critical, especially when audio or settings might be transmitted externally. This policy explains what data is collected, how it is used, and the measures taken to protect it.

## 2. Data Collection

### 2.0 Chrome Permissions

The extension requires the following Chrome permissions to function:

- **tabCapture**: Capture audio from browser tabs for transcription
- **activeTab**: Access to the currently active tab when you click "Start"
- **scripting**: Inject caption overlay into the tab when recording starts (only injected on-demand, not on all websites)
- **offscreen**: Create background audio processing context
- **tabs**: Manage recording sessions across tabs
- **storage**: Store user preferences and settings

**Important**: The extension does NOT have access to all your websites. The caption overlay is only injected into tabs where you explicitly start a recording session. No content scripts run on websites you're not actively recording.

Note: The extension makes API calls to Google Gemini AI (`https://generativelanguage.googleapis.com/*`) from the background service worker, which does not require additional host permissions.

These permissions are used solely for the core functionality described in this policy.

### 2.1 Audio Data

The core functionality of the extension requires capturing audio from the active browser tab using Chrome's `tabCapture` permission. Audio is captured only when you explicitly start a transcription session.

Captured audio data is handled as follows:

- **Local Processing**: Audio is initially processed locally in the browser using the Web Audio API and AudioWorklet to encode it into 16kHz PCM chunks suitable for AI processing.

- **Transmission to API**: If you have configured the extension with a Gemini AI API key, the processed audio chunks are sent to the API for real-time transcription and translation.

- **Retention**: Audio is not stored persistently on your device or on any servers other than the temporary processing in the API request. Once the transcription or translation is completed, audio data is discarded.

### 2.2 User Settings

To provide a personalized and seamless experience, the extension stores the following user settings using Chrome's sync storage (which syncs across your Chrome browsers if Chrome sync is enabled):

- Gemini API key(s)
- Preferred language(s) for translation
- Chunk time (how frequently audio is sent for transcription, 3-20 seconds)
- Summary interval (how often automated summaries are generated, 15-120 seconds)
- Conversation style or translation tone

These settings are stored in Chrome's sync storage and are never sent to any third party except as part of Chrome's built-in sync mechanism.

### 2.3 Browser and Webpage Data

The extension interacts minimally with webpages:

- Captions and notes overlays are injected only into the active tab you select.
- The extension does not read, store, or transmit text, images, or other content from the webpage beyond what is required for overlay placement.
- No browsing history, personal communications, or network activity is monitored.

### 2.4 No Personal or Sensitive Information

The extension does not collect:

- Names, addresses, phone numbers, email addresses, or other personally identifiable information (PII)
- Financial or payment information
- Authentication credentials (passwords, PINs, security questions)
- Health or medical data

## 3. Data Use

All data collected is used solely for the purpose of providing the extension's core functionality:

- **Transcription and Translation**: Captured audio is used to generate real-time text captions.
- **Automated Summaries**: Periodically, captions may be summarized by the AI to provide condensed notes.
- **User Experience**: Settings stored locally enable the extension to maintain your preferences across sessions.

The extension does not sell, share, or transfer your data for unrelated purposes, including marketing, advertising, analytics, or financial decision-making.

### 3.1 Transmission to Third Parties

The only third-party data transmission occurs when audio is sent to the Gemini AI API configured by the user. This is strictly for processing the audio to produce captions and translations.

- No other third parties receive your data.
- You are responsible for your API usage; the extension does not transmit API keys to any other entity.

## 4. Data Security

We implement reasonable measures to protect your data:

- Audio is processed in memory and discarded after transcription.
- User settings are stored locally and not transmitted.
- The extension does not access unrelated tabs, websites, or system resources.

However, please note that no system is completely secure. While we take appropriate measures, we cannot guarantee absolute security of transmitted data, especially when using external APIs.

## 5. User Control and Transparency

You have full control over your data:

- **Start/Stop Sessions**: Audio capture occurs only when you start a transcription session. You can stop the session at any time.
- **API Management**: You provide your own API key(s) for transcription. You may revoke or change these keys at any time.
- **Local Settings**: You can clear or modify stored settings at any time via the extension interface.

The extension does not collect or transmit any data without your explicit action.

## 6. Cookies and Tracking

The extension does not use cookies, trackers, or any analytics scripts to monitor user behavior. All functionality is performed locally in the browser or via the user-configured API endpoint.

## 7. Third-Party Services

- The extension relies on the Gemini AI API for transcription and translation.
- The extension does not control the privacy practices of this third-party service.
- Users are responsible for reviewing the Gemini AI API privacy policy to understand how their data is handled on the API side.
- No other external services are contacted.

## 8. Children's Privacy

The extension is not designed for children under 13. We do not knowingly collect personal information from children. If a parent or guardian believes their child has provided information, they should contact us to request deletion.

## 9. Compliance with Laws

The extension complies with applicable privacy and data protection laws, including:

- General Data Protection Regulation (GDPR) for users in the European Economic Area
- California Consumer Privacy Act (CCPA) for users in California, USA
- Chrome Web Store Developer Program Policies

Users may contact us with questions about data practices or privacy concerns.

## 10. Data Retention

- Audio sent to the API is not stored beyond the time needed to generate captions and translations.
- Settings stored in Chrome sync storage remain until you remove them manually or uninstall the extension.
- Automated summaries are generated in memory and displayed in the browser tab; they are cleared when you stop the recording session or close the tab.

## 11. User Rights

Depending on your jurisdiction, you may have rights regarding your personal data:

- **Access & Correction**: Review and modify settings stored in Chrome sync storage via the extension popup.
- **Deletion**: Clear your sync storage data via Chrome settings, or remove the extension entirely to delete all stored data.
- **Withdrawal of Consent**: Stop using the extension or revoke API keys to prevent further audio processing.

Since the extension does not store personal information outside Chrome's sync storage or transmit PII to external parties, many typical data rights requests are automatically satisfied.

## 12. Changes to This Privacy Policy

We may update this Privacy Policy to reflect changes in the extension, legal requirements, or best practices.

- Updates will be posted on the public repository or website.
- The "Effective Date" at the top will indicate the most recent update.
- We encourage users to review the Privacy Policy periodically to stay informed.

## 13. Contact Information

For questions, concerns, or requests regarding your privacy or this policy:

- **GitHub**: https://github.com/levohuutri/chrome-extension-live-recorder-translate

---

## Summary Statement

Live Captions Translator is designed with privacy as a core principle. It captures only the data necessary for real-time transcription, translation, and live captioning, stores minimal information locally, and transmits audio only to the user-configured API for its intended purpose. No other data is collected, shared, or sold. Users have full control over their data and can stop or modify usage at any time.
