# Cafe scan setup

Admins prepare a walkthrough from an uploaded `.sog` in **Venues → cafe → Set up 3D scan**.
An upload creates a draft; the current cafe scan stays live. The `.sog` is not
modified by setup. The optional smaller preview `.sog` uses the same coordinates.

The setup workspace keeps the scan viewer visible beside the controls on a wide
screen. Choose a step in the right panel; **Save draft** and **Publish scan** stay
at its bottom. Open **How to set up a scan** for plain-language help. On smaller
screens, the viewer appears above the controls.

1. Upload the full scan and enter its capture date. A preview file can be added
   if one is available; it is not required.
2. Open the new draft's setup preview. Click it, drag to look, use W/A/S/D to
   move relative to the direction you face, Q/E to change height, and Shift to
   move faster. **Advanced: jump to coordinates** helps if the scan is far from
   the default camera.
3. Set the scan orientation first. The current exports normally use X = 180°.
   Changing orientation clears positions and the boundary so they cannot be
   published against the wrong transform.
4. Choose an eye-height entrance view and select **Set start here**.
5. Walk the safe perimeter and choose **Add corner here** in order. The closed
   outline should be inside the room and clear of voids. Enable **Test walking
   limit** and try to move through every edge.
6. Optionally name stops and capture each view. Reorder them to define the
   visitor's Previous / Next sequence. Stops use the entrance eye height.
7. Save the draft while working. After testing, publish. Publication switches
   the scan URL and its viewing setup together. Existing live scans without a
   setup keep their previous starting view and free movement.

The current walkable area is a **single, flat polygon**. It prevents visitors
from leaving its outline; it does not model tables, walls inside the outline,
stairs, or multiple floors. Place the outline conservatively. Generated voxel
collision and automatic preview creation are later enhancements and will need
processing outside the Cloudflare upload Worker.

Drafts are absent from public listings, but scan files under the versioned
`splats/` asset path can be fetched by anyone who knows the URL. Do not upload
unreleased private material to that path.
