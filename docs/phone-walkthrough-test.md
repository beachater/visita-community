# Phone walkthrough test (BEA-8)

One iPhone (Safari) and one mid-range Android (Chrome), every published scan,
on 4G. About 20 minutes per phone. Agents have no phones, so a person runs this.

## Before you start

- **Wi-Fi off**, mobile data on (4G/LTE). Note the signal bars.
- Close other apps. Use a normal (not private) tab.
- Write down the phone model and OS version (Settings → About).

## For each scan

Open the link with `?debug=splat` at the end. A small black readout appears at
the top right of the walkthrough with the numbers. **Copy** puts the whole
readout on the clipboard; paste it into your results.

| # | Cafe | Link (on the test site) |
|---|---|---|
| 1 | Sonny's Coffee + Diner | `/cafe/sonnys?walkthrough=1&debug=splat` |
| 2 | Lito's Meals and Cafe | `/cafe/litos?walkthrough=1&debug=splat` |
| 3 | Test (only if still published) | `/cafe/test?walkthrough=1&debug=splat` |

For each one:

1. Open the link. Wait until the readout shows a number for **full detail**
   (or an error). Don't touch the screen while it loads.
2. Walk around for **one minute**: left thumb moves, right thumb looks. Turn a
   full circle at least once.
3. Tap **Copy** and paste the readout into your results.
4. Mark what happened:
   - **Opened**: the room appeared and full detail loaded.
   - **Preview only**: the room appeared but full detail didn't finish.
   - **Stopped**: "The 3D view stopped…" message. Tap **Reopen in preview
     mode** (when offered) and note whether that works.
   - **Page reloaded / crashed**: Safari showed "A problem repeatedly
     occurred" or the page reloaded by itself. Open the same link again: it
     should start in **Preview mode**. Note whether it did.
5. Note anything else: very slow, choppy movement, phone got hot, blank or
   black screen.
6. Close the walkthrough (X), then go on to the next scan in the **same tab**.

## Results to send back

For each phone:

- Phone model, OS version, browser, signal (bars or speed test).
- For each scan: the outcome (Opened / Preview only / Stopped / Crashed), the
  pasted readout, and any notes.

**Pass:** every published scan reaches **Opened** on both phones, and nothing
crashes during the one-minute walk.
