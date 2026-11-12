import type { LegalText } from ".";

export const de: LegalText = {
  impressum: (op) => ({
    title: "Impressum",
    sections: [
      {
        h: "Angaben gemäß § 5 DDG",
        p: [
          op.lines.join("\n"),
          ...(op.representative ? [`Vertreten durch: ${op.representative}`] : []),
          ...(op.register ? [`Registereintrag: ${op.register}`] : []),
          ...(op.vatId ? [`Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${op.vatId}`] : []),
        ],
      },
      { h: "Kontakt", p: [[`E-Mail: ${op.email}`, ...(op.phone ? [`Telefon: ${op.phone}`] : [])].join("\n")] },
      { h: "Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)", p: [op.lines.slice(0, 3).join("\n")] },
      {
        h: "Verbraucherstreitbeilegung",
        p: ["Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."],
      },
      {
        h: "Hinweis zu den Inhalten",
        p: [
          "rideff Life hilft beim Ordnen von Geld, Zeit und Alltag. Die App und ihr Assistent ersetzen keine Steuer-, Rechts-, Anlage- oder medizinische Beratung. Berechnungen und Antworten der KI können falsch sein; prüfe wichtige Zahlen selbst.",
        ],
      },
    ],
  }),

  privacy: (op) => ({
    title: "Datenschutzerklärung",
    sections: [
      {
        h: "1. Verantwortlicher",
        p: [`${op.lines.join(", ")}\nE-Mail: ${op.email}`, "Bei Fragen zum Datenschutz erreichst du uns unter dieser Adresse."],
      },
      {
        h: "2. Welche Daten wir verarbeiten",
        p: [
          "Kontodaten: E-Mail-Adresse, Anzeigename, Sprache, Rolle im Haushalt, Passkeys oder ein Passwort-Hash, Zeitpunkte der Anmeldung.",
          "Inhalte, die du einträgst: Einnahmen, Ausgaben, Budgets, Schulden, Abos, Schichten, Ziele, Tagebuch- und Trainingseinträge, hochgeladene Dateien wie Belege und Kontoauszüge sowie Nachrichten an den Assistenten und dessen Erinnerungen.",
          "Zahlungsdaten: gewählter Tarif, Abrechnungsstatus und eine Kundennummer bei Stripe. Karten- und Kontodaten sehen und speichern wir nicht; sie liegen bei Stripe.",
          "Technische Daten: IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browserangaben in Server-Protokollen sowie, wenn du Mitteilungen einschaltest, die Push-Adresse deines Geräts.",
        ],
      },
      {
        h: "3. Zwecke und Rechtsgrundlagen",
        p: [
          "Bereitstellung der App, deines Kontos und der bezahlten Funktionen: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).",
          "Sicherheit, Missbrauchsschutz und Fehlersuche: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).",
          "Sprachassistent, Telegram-Verbindung und Push-Mitteilungen: deine Einwilligung, die du jederzeit in den Einstellungen widerrufen kannst (Art. 6 Abs. 1 lit. a DSGVO).",
          "Trägst du freiwillig Angaben zur Gesundheit ein, etwa im Tagebuch oder beim Training, verarbeiten wir sie nur, um sie dir anzuzeigen, auf Grundlage deiner ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO).",
          "Rechnungen und Zahlungsbelege: gesetzliche Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO).",
        ],
      },
      {
        h: "4. Empfänger und Auftragsverarbeiter",
        p: [
          "Supabase (Datenbank, Anmeldung, Dateiablage): Speicherung in Frankfurt am Main, EU.",
          "Vercel (Hosting und Auslieferung der App): Serverfunktionen laufen in Frankfurt am Main; der Anbieter hat seinen Sitz in den USA.",
          "Stripe Payments Europe, Irland (Zahlungsabwicklung).",
          "Anthropic, USA (KI-Assistent): erhält deine Frage, den dafür nötigen Ausschnitt deiner Daten und Dateien, die du lesen lässt.",
          "OpenAI, Irland/USA (Sprachassistent): erhält die Tonaufnahme deines Gesprächs, solange es läuft, und nur, wenn du den Sprachmodus startest.",
          "Telegram (nur wenn du deinen Account verbindest): erhält die Nachrichten, die der Bot dir schickt.",
          "Push-Dienste von Apple, Google oder Mozilla (nur bei eingeschalteten Mitteilungen): erhalten verschlüsselte Mitteilungen.",
          "Mit Dienstleistern, die in unserem Auftrag arbeiten, bestehen Verträge zur Auftragsverarbeitung. Wir verkaufen keine Daten und zeigen keine Werbung.",
        ],
      },
      {
        h: "5. Übermittlung in Drittländer",
        p: [
          "Einige Dienstleister sitzen in den USA oder verarbeiten Daten dort. Die Übermittlung stützt sich auf den Angemessenheitsbeschluss zum EU-US Data Privacy Framework, soweit der Anbieter zertifiziert ist, sonst auf die Standardvertragsklauseln der EU-Kommission.",
        ],
      },
      {
        h: "6. KI-Assistent",
        p: [
          "Der Assistent beantwortet Fragen auf Grundlage deiner eigenen Einträge. Nach den Vertragsbedingungen der KI-Anbieter werden über die Schnittstelle gesendete Inhalte nicht zum Training ihrer Modelle verwendet.",
          "Es findet keine automatisierte Entscheidung mit rechtlicher Wirkung im Sinne von Art. 22 DSGVO statt. Änderungen an deinen Daten schlägt der Assistent vor; du bestätigst sie.",
        ],
      },
      {
        h: "7. Cookies und Speicher auf deinem Gerät",
        p: [
          "Wir setzen nur ein, was die App technisch braucht (§ 25 Abs. 2 TDDDG): ein Cookie für die Sprache, die Anmeldung, die Offline-Kopie deiner Daten, deine Darstellungseinstellungen und, falls du sie einschaltest, den Hash deiner PIN. Es gibt keine Tracking- oder Werbe-Cookies und keine Analysedienste.",
        ],
      },
      {
        h: "8. Speicherdauer und Löschung",
        p: [
          "Wir speichern deine Daten, solange dein Konto besteht. Unter Einstellungen → Daten kannst du eine Kopie exportieren, deine Einträge löschen oder dein Konto vollständig löschen. Mit dem Konto werden deine Einträge und Dateien sofort entfernt; Sicherungskopien unserer Dienstleister laufen nach deren festen Fristen aus.",
          "Rechnungs- und Zahlungsdaten bleiben bei Stripe und bei uns, solange gesetzliche Aufbewahrungsfristen es verlangen. Server-Protokolle werden nach kurzer Zeit gelöscht.",
        ],
      },
      {
        h: "9. Gemeinsame Haushalte",
        p: [
          "Trittst du einem Haushalt bei, sehen dessen Mitglieder die Einträge, die als „Familie“ markiert sind, und was der Inhaber für dich freigibt. Private Einträge bleiben nur für dich sichtbar.",
        ],
      },
      {
        h: "10. Deine Rechte",
        p: [
          "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15 bis 21 DSGVO). Eine Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.",
          "Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der Behörde deines Wohnorts (Art. 77 DSGVO).",
          "Die Angabe deiner E-Mail-Adresse ist für das Konto erforderlich. Alle weiteren Eintragungen sind freiwillig.",
        ],
      },
    ],
  }),

  terms: (op) => ({
    title: "Allgemeine Geschäftsbedingungen",
    sections: [
      {
        h: "1. Geltungsbereich und Anbieter",
        p: [
          `Diese Bedingungen gelten für die Nutzung von rideff Life. Anbieter und Vertragspartner ist ${op.name}, ${op.street}, ${op.city}. Das Angebot richtet sich an Verbraucher ab 18 Jahren.`,
        ],
      },
      {
        h: "2. Leistung",
        p: [
          "rideff Life ist eine Web-App, mit der du Geld, Zeit und Alltag deines Haushalts ordnest. Der Umfang hängt vom Tarif ab (Life, Life Plus, Together) und ist auf der Tarifseite beschrieben.",
          "Die App und ihr KI-Assistent geben keine Steuer-, Rechts-, Anlage- oder medizinische Beratung. Antworten und Berechnungen können unvollständig oder falsch sein. Entscheidungen triffst du selbst.",
          "Für KI-Funktionen gelten Mengengrenzen pro Tag oder Monat, die auf der Tarifseite genannt sind.",
        ],
      },
      {
        h: "3. Konto und Testphase",
        p: [
          "Mit der Anmeldung per E-Mail entsteht ein kostenloses Konto mit einer Testphase von 14 Tagen. Dafür sind keine Zahlungsdaten nötig, und die Testphase geht nicht von selbst in einen bezahlten Tarif über.",
          "Nach der Testphase steht ohne bezahlten Tarif nur ein eingeschränkter Umfang zur Verfügung. Deine Daten bleiben erhalten und exportierbar.",
          "Halte deine Zugangsdaten geheim und trage nur Daten ein, über die du verfügen darfst.",
        ],
      },
      {
        h: "4. Vertragsschluss für bezahlte Tarife",
        p: [
          "Die Darstellung der Tarife ist kein bindendes Angebot. Du gibst ein Angebot ab, indem du im Bezahlvorgang bei unserem Zahlungsdienstleister Stripe den Kauf bestätigst. Der Vertrag kommt zustande, wenn wir den Tarif freischalten. Den Vertragstext kannst du jederzeit auf dieser Seite abrufen; Vertragssprache ist Deutsch.",
        ],
      },
      {
        h: "5. Preise und Zahlung",
        p: [
          "Es gelten die im Bezahlvorgang angezeigten Preise in Euro als Endpreise. Abgerechnet wird je nach Wahl monatlich oder jährlich im Voraus über die bei Stripe hinterlegte Zahlungsart.",
          "Schlägt eine Zahlung fehl, dürfen wir bezahlte Funktionen sperren, bis der offene Betrag beglichen ist.",
        ],
      },
      {
        h: "6. Laufzeit und Kündigung",
        p: [
          "Ein bezahlter Tarif läuft einen Monat oder ein Jahr und verlängert sich um denselben Zeitraum, wenn er nicht gekündigt wird. Jahrestarife verlängern sich nach dem ersten Jahr auf unbestimmte Zeit und sind dann jederzeit mit einer Frist von einem Monat kündbar; zu viel Gezahltes erstatten wir anteilig.",
          `Du kannst jederzeit zum Ende des laufenden Zeitraums kündigen: in der App unter Tarif → Zahlung verwalten oder per E-Mail an ${op.email}. Das Recht zur Kündigung aus wichtigem Grund bleibt unberührt.`,
          "Dein Konto kannst du jederzeit unter Einstellungen → Daten löschen. Damit endet auch ein bezahlter Tarif sofort.",
        ],
      },
      {
        h: "7. Widerrufsrecht",
        p: ["Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Einzelheiten stehen in der Widerrufsbelehrung."],
      },
      {
        h: "8. Verfügbarkeit und Änderungen",
        p: [
          "Wir bemühen uns um einen durchgehenden Betrieb, können aber Unterbrechungen durch Wartung oder Störungen nicht ausschließen. Wir stellen Aktualisierungen bereit, die für den vertragsgemäßen Zustand nötig sind.",
          "Wir dürfen die App weiterentwickeln, solange der Kern des gebuchten Tarifs erhalten bleibt. Über wesentliche Änderungen dieser Bedingungen oder der Preise informieren wir mindestens sechs Wochen vorher per E-Mail; du kannst dann zum Zeitpunkt der Änderung kündigen. Preisänderungen gelten erst ab dem nächsten Abrechnungszeitraum und nur mit deiner Zustimmung.",
        ],
      },
      {
        h: "9. Haftung",
        p: [
          "Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten haften wir begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Im Übrigen ist die Haftung ausgeschlossen. Die gesetzlichen Gewährleistungsrechte für digitale Produkte bleiben bestehen.",
        ],
      },
      {
        h: "10. Schlussbestimmungen",
        p: [
          "Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften des Staates, in dem du deinen gewöhnlichen Aufenthalt hast, bleiben anwendbar.",
          "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
          "Ist eine Bestimmung unwirksam, bleiben die übrigen wirksam.",
        ],
      },
    ],
  }),

  withdrawal: (op) => ({
    title: "Widerrufsbelehrung",
    sections: [
      {
        h: "Widerrufsrecht",
        p: [
          "Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.",
          `Um dein Widerrufsrecht auszuüben, musst du uns (${op.lines.join(", ")}, E-Mail: ${op.email}) mittels einer eindeutigen Erklärung, zum Beispiel per E-Mail oder Brief, über deinen Entschluss informieren, diesen Vertrag zu widerrufen. Du kannst dafür das unten stehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
          "Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absendest.",
        ],
      },
      {
        h: "Folgen des Widerrufs",
        p: [
          "Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf bei uns eingegangen ist. Für die Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Zahlung eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart; Entgelte berechnen wir dafür nicht.",
          "Hast du verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so hast du uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zum Widerruf bereits erbrachten Leistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Leistungen entspricht.",
        ],
      },
      {
        h: "Muster-Widerrufsformular",
        p: [
          "Wenn du den Vertrag widerrufen willst, fülle dieses Formular aus und sende es zurück.",
          `An ${op.lines.join(", ")}, E-Mail: ${op.email}`,
          "Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung: rideff Life, Tarif ______",
          "Bestellt am: ______\nName des/der Verbraucher(s): ______\nE-Mail-Adresse des Kontos: ______\nAnschrift des/der Verbraucher(s): ______\nDatum: ______",
          "(*) Unzutreffendes streichen.",
        ],
      },
    ],
  }),
};
