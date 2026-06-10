
Claude finished the response
Let’s get cooking! Pick an artifact category or start building your idea from scratch.


Apps and websites

Documents and templates

Games

Productivity tools

Creative projects

Quiz or survey

Start from scratch
Start from scratch

13.36
I'd love to help you create something! To get started, what kind of artifact did you have in mind?

Apps and websites — interactive tools, dashboards, landing pages
Documents and templates — reports, letters, structured docs
Games — browser-based games of any kind
Productivity tools — planners, trackers, calculators
Creative projects — stories, poems, visual art
Quiz or survey — trivia, personality tests, feedback forms
Something else — just describe it!
Du skal hver dag gå i vores backend på dandomain og se hvilke ordrer der har været den dag - under hver ordrer kan du se tracking ID og. så skal du tracke om de har fået et scan

13.37
Det lyder som en fed automatiseringsidé! For at forstå hvad du har brug for, må jeg stille et par spørgsmål:

Hvilken platform bruger I til tracking? (f.eks. PostNord, GLS, DAO, Bring?)
Har du adgang til DanDomain via API, eller skal det gøres via browser-automatisering?
Hvornår skal tjekket køre? (f.eks. hver aften kl. 20?)
Men jeg vil også være ærlig: Det her er en opgave der kræver server-side automatisering (f.eks. et script der kører dagligt), ikke noget jeg kan udføre løbende som en AI-assistent i chatten.

Hvad jeg kan hjælpe dig med:

Et færdigt script (Python/Node.js) du kan sætte op til at køre automatisk hver dag
En webapp/dashboard der viser ordrernes tracking-status når du åbner den
Instruktioner til at sætte det hele op
Hvad er mest brugbart for dig?

du kan bruge parcelapp.com

13.37
God idé! Parcelapp.com er et smart valg til tracking.

Lad mig få lidt mere info før jeg bygger det:

Q: Hvordan vil du helst logge ind på DanDomain?
A: Jeg har en API-nøgle til DanDomain

Q: Hvad skal appen vise?
A: Alle dagens ordrer med status

13.38
Perfekt! En sidste ting:

Q: Hvilken fragtleverandør bruger I primært?
A: DSV

Q: Har du en API-nøgle til parcelapp.com?
A: Nej, jeg vil bruge parcelapp.com manuelt

13.38
Godt, her er planen for appen:


Searched the web
Searched the web
Godt, jeg har det jeg skal bruge. Her er planen:

Hvad appen gør:

Du indtaster din DanDomain shop-URL og API-nøgle
Appen henter alle dagens ordrer via DanDomain API
For hver ordre vises ordre-nr., kundenavn og tracking ID (DSV)
Ved siden af tracking ID er der et direkte link til parcelapp.com så du hurtigt kan tjekke status manuelt
Begrænsning: Parcelapp.com har ikke en offentlig API uden nøgle, så tracking-status åbner i et nyt faneblad — du klikker bare på tracking-linket.

Er du klar til at jeg bygger det?

Yes

13.38

DanDomain DSV Ordre Tracker
Interactive artifact 
Her er din ordre tracker! Sådan bruger du den:

Opsætning:

Indtast din shop URL (f.eks. minshop.dk)
Indsæt din DanDomain API-nøgle
Angiv dit Site ID (som regel 1 — kan findes under Indstillinger i DanDomain)
Klik "Hent dagens ordrer"
Hvad den gør:

Henter alle ordrer fra i dag via DanDomain's API
Viser ordre-nr., kunde, tracking ID og status
Klik "Spor ↗" på en ordre for at åbne den direkte på parcelapp.com
Brug "Opdater"-knappen til at genindlæse i løbet af dagen
Bemærk: Tracking-feltet henter trackAndTraceCode fra DanDomain. Sørg for at DSV's tracking ID er gemt i dette felt på ordrerne — ellers vil de vises som "Intet tracking". Sig til hvis du bruger et andet felt i DanDomain til tracking ID'et, så kan jeg justere det.

hov ændre site ID til 26

13.42

DanDomain DSV Ordre Tracker
Interactive artifact ∙ Version 2 
Gjort! Site ID er nu sat til 26 som standard.

hvorfor virker det ikke

13.42
Det er svært at sige præcis uden at se en fejlbesked. Hvad sker der når du forsøger at hente ordrer?

De mest almindelige årsager er:

CORS-blokering — DanDomain's API tillader sandsynligvis ikke direkte browserforespørgsler fra en ekstern side. Det er den mest sandsynlige årsag — browseren blokerer kaldet stille.
Forkert URL-format — API'et kræver muligvis http:// i stedet for https://, eller din shop-URL har en underlig struktur.
Forkert API endpoint — DanDomain har både v1 og v2. Hvis din shop er på v2 er endpointet anderledes.
Det reelle problem: Da appen kører direkte i browseren, vil DanDomain's API næsten helt sikkert blokere kaldet pga. CORS. Det kan ikke løses i en webapp uden en mellemliggende server.

Den rigtige løsning er et af disse:

Et Python/Node.js script du kører lokalt eller på en server — det har ingen CORS-begrænsninger
En simpel proxy-server (f.eks. gratis på Railway eller Render) der kalder DanDomain og returnerer data til appen
Vil du have at jeg laver et Python-script du bare kan køre dagligt på din computer i stedet? Det ville være langt mere pålideligt.

ja gør det som er bedst og virker

13.43
Her er et Python-script der kører lokalt:


dandomain_tracker.py
Code 
Sådan sætter du det op (trin for trin):

1. Installer Python hvis du ikke har det: python.org/downloads

2. Installer requests-biblioteket — åbn Terminal (Mac) eller Kommandoprompt (Windows) og skriv:

pip install requests
3. Rediger scriptet — åbn filen og udfyld dine egne værdier i toppen:

python
SHOP_URL = "minshop.dk"       # ← din rigtige shop-URL
API_KEY  = "DIN-API-NØGLE"    # ← din API-nøgle fra DanDomain
4. Kør scriptet hver dag:

python dandomain_tracker.py
Det printer en overskuelig liste i terminalen med alle dagens ordrer, opdelt i dem med og uden tracking ID, med direkte links til parcelapp.com.

Vil du have at det automatisk åbner tracking-links i browseren, eller at det sender dig en mail/besked hvis der er ordrer uden scan?

Ej det skal laves så vi kører det her på denne app

13.44
Forstået! Problemet er CORS — vi kan ikke kalde DanDomain direkte fra browseren. Men vi kan bruge Claude API'et som en proxy/mellemled til at hente dataene.

Dog er der én hård begrænsning: Claude API'et kan heller ikke kalde DanDomain's API på dine vegne.

Den eneste reelle løsning der virker i en webapp er:

En simpel gratis proxy — jeg bygger dig en lille Node.js server du deployer gratis på Railway.app (tager 10 min, kræver ingen erfaring)
Eller: Brug Claude i Chrome — du har faktisk Claude i Chrome tilgængeligt, som kan styre din browser og gå ind på DanDomain's admin panel og hente ordrerne visuelt
Hvilken løsning passer dig bedst?

Railway proxy — kræver lidt opsætning én gang, derefter virker appen bare
Claude i Chrome — jeg styrer din browser direkte og henter ordrerne for dig nu
lad os prøve proxy

13.45
Perfekt! Jeg laver dig to ting: en proxy-server og en opdateret webapp.

Plan:

En lille Node.js proxy du deployer gratis på Railway
Den opdaterede webapp der kalder din proxy i stedet for DanDomain direkte

server.js (Railway proxy)
Code 

package.json
Code 
Sådan deployer du proxyen på Railway (gratis, ~10 min):

Trin 1 — Opret de to filer Lav en ny mappe på din computer kaldet dandomain-proxy og gem begge filer (server.js og package.json) i den.

Trin 2 — Opret GitHub repo

Gå til github.com og opret en gratis konto hvis du ikke har en
Lav et nyt repository kaldet dandomain-proxy og upload de to filer
Trin 3 — Deploy på Railway

Gå til railway.app og log ind med GitHub
Klik "New Project" → "Deploy from GitHub repo" → vælg dandomain-proxy
Railway finder automatisk package.json og starter serveren
Gå til "Settings" → "Networking" → "Generate Domain" — du får en URL som fx dandomain-proxy-production.up.railway.app
Trin 4 — Opdater webapp Når du har din Railway-URL, giv mig den og jeg opdaterer webapp'en så den kalder din proxy i stedet. Så virker det hele i browseren uden problemer.

Sig til hvis du sidder fast undervejs!

Skærmbillede 20260610 kl. 13.49.06.png
hvor sætter jeg de to filer ind

13.49
Perfekt, du har oprettet repo'et! Nu skal du uploade filerne direkte på GitHub:

Klik på "creating a new file" linket (det blå link midt på siden)
Kald filen server.js og indsæt indholdet fra server.js artifacten herover
Klik "Commit changes" nederst
Gå tilbage til repo'et og klik "creating a new file" igen
Kald den package.json og indsæt indholdet fra package.json artifacten
Klik "Commit changes" igen
Så har du begge filer i repo'et og er klar til Railway. Sig til når det er gjort!







Claude is AI and can make mistakes. Please double-check responses.
const express = require("express");
const fetch = require("node-fetch");
const app = express();

// Tillad alle origins (så din webapp kan kalde proxyen)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get("/ordrer", async (req, res) => {
  const { shop, key, site } = req.query;

  if (!shop || !key || !site) {
    return res.status(400).json({ error: "Mangler shop, key eller site parameter" });
  }

  const today = new Date().toISOString().split("T")[0];
  const url = `http://${shop}/admin/webapi/Endpoints/v1_0/OrderService/${key}/GetOrdersByDateInterval/${today}T00:00:00/${today}T23:59:59/${site}`;

  try {
    const r = await fetch(url, { timeout: 15000 });
    if (!r.ok) throw new Error(`DanDomain svarede med HTTP ${r.status}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => res.send("DanDomain proxy kører ✓"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy kører på port ${PORT}`));
