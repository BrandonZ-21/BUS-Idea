// Site-wide settings that aren't secret and aren't per-owner.
const TALLY_CONFIG = {
  // The Google Form behind every "Give feedback" link, and the QR code on
  // the printable card (card.html). Paste the form's share link between the
  // quotes, e.g. "https://forms.gle/abc123". Leave it empty to hide feedback
  // links everywhere. Tally only ever opens this link as written -- it never
  // adds anything to it and never sends the form any sales or business data.
  feedbackFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfJ7K3j0KxON1BXdOTdUVvFK7P2YcJRZLzdSkbrXIN2Z50ZPg/viewform",

  // Printed on the card for people who want to try the app.
  appUrl: "https://bus-idea.pages.dev",
};
